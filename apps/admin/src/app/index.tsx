import "@repo/design-system/styles/globals.css"
import { Button } from "@repo/design-system/components/ui/button"

function App() {
  return (
    <div className="container">
      <h1 className="title">
        Admin <br />
        <span>Kitchen Sink</span>
      </h1>
      <Button>Click me</Button>
      <p className="description">
        Built With{" "}
        <Button asChild>
          <a href="https://turborepo.com" target="_blank" rel="noopener noreferrer">
            Turborepo
          </a>
        </Button>
        {" & "}
        <Button asChild>
          <a href="https://vitejs.dev/" target="_blank" rel="noopener noreferrer">
            Vite
          </a>
        </Button>
      </p>
    </div>
  );
}

export default App;
