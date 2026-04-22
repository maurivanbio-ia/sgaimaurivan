import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
<<<<<<< HEAD
import { Router } from "wouter";
=======
import { BrowserRouter } from "react-router-dom";
>>>>>>> 0009a6ab6f604bab51f2f46e71f61cc3092b36d1

import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
<<<<<<< HEAD
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <App />
    </Router>
=======
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
>>>>>>> 0009a6ab6f604bab51f2f46e71f61cc3092b36d1
  </StrictMode>,
);
