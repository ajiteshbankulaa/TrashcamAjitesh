import { useEffect, useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Package, AlertTriangle } from "lucide-react";
import { getLogs } from "../api";

type TargetCategory = "recycling" | "trash";

interface Event {
  timestamp: string;
  type: "correct" | "incorrect";
  message: string;
}

interface BackendLog {
  timestamp: string;
  item: string;
  class: string;
}

interface EventLogProps {
  targetCategory: TargetCategory;
  scrollHeight?: number;
}

// very simple recyclable classifier
const isRecyclableClass = (cls: string): boolean => {
  const c = cls.toLowerCase();
  if (c.includes("plastic")) return true;
  if (c.includes("glass")) return true;
  if (c.includes("paper")) return true;
  if (c.includes("cardboard")) return true;
  if (c.includes("can")) return true;
  if (c.includes("aluminum")) return true;
  return false;
};

export function EventLog({
  targetCategory,
  scrollHeight = 800,
}: EventLogProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    async function loadLogs() {
      try {
        const data = await getLogs();
        const logs: BackendLog[] = data.logs || [];

        const mapped: Event[] = logs.map((log) => {
          const cls = log.class || "";
          const item = log.item || "";
          const ts = log.timestamp;
          const recyclable = isRecyclableClass(cls);

          let type: Event["type"];
          let message: string;

          if (targetCategory === "recycling") {
            if (recyclable) {
              type = "correct";
              message = `${item} correctly placed in RECYCLING (${cls})`;
            } else {
              type = "incorrect";
              message = `${item} should NOT be in RECYCLING (${cls})`;
            }
          } else {
            // trash mode
            if (recyclable) {
              type = "incorrect";
              message = `${item} should be RECYCLED, not TRASHED (${cls})`;
            } else {
              type = "correct";
              message = `${item} correctly placed in TRASH (${cls})`;
            }
          }

          return { timestamp: ts, type, message };
        });

        setEvents(mapped);
      } catch (err) {
        console.error("Error loading logs:", err);
        setEvents([]);
      }
    }

    loadLogs();
    const id = setInterval(loadLogs, 2000); // keep refreshing so clearData shows
    return () => clearInterval(id);
  }, [targetCategory]);

  const getEventIcon = (type: Event["type"]) =>
    type === "correct" ? Package : AlertTriangle;

  const getEventColor = (type: Event["type"]) =>
    type === "correct" ? "#50d0e0" : "#ff4466";

  return (
    <div className="bg-[#1a1a3e] border-4 border-[#50d070] p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]">
      <div className="mb-4">
        <h2
          className="text-[#50d070] tracking-wider"
          style={{
            fontFamily: "monospace",
            textShadow: "2px 2px 0px rgba(80,208,112,0.3)",
          }}
        >
          === EVENT LOG ===
        </h2>
        <p
          className="text-xs text-[#50d070]/70 tracking-wide"
          style={{ fontFamily: "monospace" }}
        >
          MODE: {targetCategory === "recycling" ? "RECYCLING" : "TRASH"}
        </p>
      </div>

      <ScrollArea className="pr-4" style={{ height: scrollHeight }}>
        <div className="space-y-2">
          {events.map((event, index) => {
            const Icon = getEventIcon(event.type);
            const color = getEventColor(event.type);
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={index}
                className="bg-[#0f0f23] border-2 p-3 cursor-pointer transition-all duration-200 ease-in-out"
                style={{
                  borderColor: isHovered ? color : `${color}66`,
                  boxShadow: isHovered ? `0 0 8px ${color}80` : "none",
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color }}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className="tracking-wider"
                      style={{ fontFamily: "monospace", color }}
                    >
                      {event.timestamp}
                    </span>

                    <p
                      className="tracking-wide break-words"
                      style={{ fontFamily: "monospace", color: `${color}cc` }}
                    >
                      {event.message}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {events.length === 0 && (
            <p
              className="text-[#50d070]/60 text-sm tracking-wide"
              style={{ fontFamily: "monospace" }}
            >
              No events yet.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
