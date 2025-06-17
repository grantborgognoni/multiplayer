import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./app";
import "@repo/design-system/styles/globals.css"

const root = document.getElementById("root");

if (!root) {
  throw new Error("Could not find root element");
}

ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
