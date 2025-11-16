import { useState, useEffect, useRef } from "react";
import { TrashCanCard } from "./TrashCanCard";
import { StatusBar } from "./StatusBar";
import { EventLog } from "./EventLog";
import { Trash2 } from "lucide-react";
import { getLogs, getFill } from "../api";

export type EventType = "deposit" | "empty" | "alert" | "contamination";

export interface TrashCanData {
  id: string;
  name: string;
  fillLevel: number;
  weight: number;
  lastEmptied: string;
  status: "normal" | "warning" | "critical";
  location: string;
  targetCategory: "recyclable" | "organic" | "general";
  categories: {
    recyclable: number;
    organic: number;
    general: number;
  };
  events: Array<{
    timestamp: string;
    type: EventType;
    category: string;
    message: string;
  }>;
}

const initialTrashCanData: TrashCanData = {
  id: "TC001",
  name: "Main Entrance",
  fillLevel: 0,
  weight: 0,
  lastEmptied: new Date().toISOString(),
  status: "normal",
  location: "Building A",
  targetCategory: "recyclable",
  categories: {
    recyclable: 0,
    organic: 0,
    general: 0,
  },
  events: [],
};

interface BackendLog {
  timestamp: string;
  item: string;
  class: string;
}

// ------------------------------------------------------------
// FIXED CLASSIFIER -------------------------------------------
// ------------------------------------------------------------
const classifyItem = (
  cls: string,
  item: string
): "recyclable" | "organic" | "general" => {
  const c = cls.toLowerCase().trim();
  const i = item.toLowerCase().trim();

  // 1) Direct backend classification
  if (c.includes("recycling") || c.includes("recyclable")) {
    return "recyclable";
  }
  if (c.includes("compost") || c.includes("organic")) {
    return "organic";
  }
  if (c.includes("trash") || c.includes("landfill")) {
    return "general";
  }

  // 2) Fallback by item text
  if (
    i.includes("bottle") ||
    i.includes("can") ||
    i.includes("paper") ||
    i.includes("cardboard") ||
    i.includes("glass") ||
    i.includes("aluminum")
  ) {
    return "recyclable";
  }

  if (
    i.includes("banana") ||
    i.includes("apple") ||
    i.includes("fruit") ||
    i.includes("vegetable") ||
    i.includes("food") ||
    i.includes("compost")
  ) {
    return "organic";
  }

  return "general";
};

export function Dashboard() {
  const [trashCans, setTrashCans] = useState<TrashCanData[]>([
    initialTrashCanData,
  ]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const processedLogs = useRef<Set<string>>(new Set());
  const primaryTargetCategory = trashCans[0]?.targetCategory;

  const calculateStatus = (
    fillLevel: number
  ): "normal" | "warning" | "critical" => {
    if (fillLevel >= 90) return "critical";
    if (fillLevel >= 75) return "warning";
    return "normal";
  };

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ------------------------------------------------------------
  // MAIN LOGIC – NO MORE MESSAGE REWRITE EFFECT (FIXED)
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadEvents() {
      try {
        const [logsData, fillData] = await Promise.all([
          getLogs().catch(() => null),
          getFill().catch(() => 0),
        ]);
        const logs = logsData?.logs as BackendLog[] | undefined;
        const fill = fillData ?? 0;
        if (!logs) return;

        setTrashCans((prev) =>
          prev.map((can, index) => {
            if (index !== 0) return can;

            let updatedCategories = { ...can.categories };
            const newEvents: TrashCanData["events"] = [];
            let changes = 0;

            logs.forEach((log) => {
              const sig = `${log.timestamp}-${log.item}-${log.class}`;
              if (processedLogs.current.has(sig)) return;

              processedLogs.current.add(sig);

              const detectedCategory = classifyItem(log.class, log.item);
              const isContamination = detectedCategory !== can.targetCategory;

              updatedCategories[detectedCategory] += 1;
              changes++;

              // ALWAYS create clean message ONCE (safe)
              const message = isContamination
                ? `Non-${can.targetCategory.toUpperCase()}: ${detectedCategory} (${log.item} – ${log.class})`
                : `${detectedCategory} detected (${log.item} – ${log.class})`;

              newEvents.push({
                timestamp: log.timestamp,
                type: isContamination ? "contamination" : "deposit",
                category: detectedCategory,
                message,
              });
            });

            const newWeight = can.weight + Math.min(25, changes * 0.5);
            const newStatus = calculateStatus(fill);

            let finalEvents = [...newEvents, ...can.events];

            // Alert event
            if (fill >= 80 && can.fillLevel < 80) {
              finalEvents.unshift({
                timestamp: new Date().toLocaleTimeString("en-US", {
                  hour12: false,
                }),
                type: "alert",
                category: "system",
                message: `Fill level reached ${fill}%`,
              });
            }

            return {
              ...can,
              fillLevel: fill,
              weight: parseFloat(newWeight.toFixed(1)),
              status: newStatus,
              categories: updatedCategories,
              events: finalEvents.slice(0, 50),
            };
          })
        );
      } catch {}
    }

    loadEvents();
    const id = setInterval(loadEvents, 2000);
    return () => clearInterval(id);
  }, [primaryTargetCategory]);

  // ------------------------------------------------------------
  // UTILITIES
  // ------------------------------------------------------------
  const updateTrashCan = (id, updates) => {
    setTrashCans((prev) =>
      prev.map((can) => {
        if (can.id !== id) return can;
        const updated = { ...can, ...updates };
        if (updates.fillLevel !== undefined) {
          updated.status = calculateStatus(updates.fillLevel);
        }
        return updated;
      })
    );
  };

  const emptyTrashCan = (id) => {
    processedLogs.current.clear();

    setTrashCans((prev) =>
      prev.map((can) => {
        if (can.id !== id) return can;

        return {
          ...can,
          fillLevel: 0,
          weight: 0,
          categories: { recyclable: 0, organic: 0, general: 0 },
          lastEmptied: new Date().toISOString(),
          status: "normal",
          events: [
            {
              timestamp: new Date().toLocaleTimeString("en-US", {
                hour12: false,
              }),
              type: "empty",
              category: "system",
              message: "Trash can emptied",
            },
            ...can.events.slice(0, 49),
          ],
        };
      })
    );
  };

  const removeEvent = (trashCanId, index) => {
    setTrashCans((prev) =>
      prev.map((can) => {
        if (can.id !== trashCanId) return can;
        const evs = [...can.events];
        evs.splice(index, 1);
        return { ...can, events: evs };
      })
    );
  };

  const totalCans = trashCans.length;
  const criticalCans = trashCans.filter((c) => c.status === "critical").length;
  const warningCans = trashCans.filter((c) => c.status === "warning").length;

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center gap-3 mb-4 px-6 py-3 bg-[#1a1a3e] border-4 border-[#50d070] shadow-[4px_4px_0px_rgba(80,208,112,0.3)]">
          <Trash2 className="w-8 h-8 text-[#50d070]" />
          <h1
            className="text-[#50d070] tracking-wider"
            style={{
              fontFamily: "monospace",
              textShadow: "2px 2px rgba(80,208,112,0.3)",
            }}
          >
            SMART TRASH MONITOR v1.0
          </h1>
        </div>

        <StatusBar
          totalCans={totalCans}
          criticalCans={criticalCans}
          warningCans={warningCans}
          currentTime={currentTime}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        <div className="lg:col-span-2">
          {trashCans.map((t) => (
            <TrashCanCard
              key={t.id}
              data={t}
              onUpdate={(u) => updateTrashCan(t.id, u)}
              emptyTrash={() => emptyTrashCan(t.id)}
              currentTime={currentTime}
            />
          ))}
        </div>

        <div className="lg:col-span-1">
          {trashCans.map((t) => (
            <EventLog
              key={`events-${t.id}`}
              events={t.events}
              targetCategory={t.targetCategory}
              onRemoveEvent={(i) => removeEvent(t.id, i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
