// frontend/src/App.jsx
import { useEffect, useState } from "react";
import { getHealth } from "./api";
import "./App.css";

function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getHealth()
      .then((data) => setHealth(data.status))
      .catch((err) => {
        console.error(err);
        setHealth("error");
      });
  }, []);

  return (
    <div className="app">
      <h1>React + FastAPI</h1>
      <p>Backend health: {health ?? "checking..."}</p>
    </div>
  );
}

export default App;
