import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/base.css";
import "./styles/components.css";
// Общая карточка используется в нескольких лениво загружаемых разделах.
import "./components/AbilityCard.css";

const root = document.getElementById("root");
if (!root) throw new Error("Не найден корневой элемент #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
