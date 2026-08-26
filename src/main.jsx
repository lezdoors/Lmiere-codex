import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { LanguageProvider } from "./i18n.jsx";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Lmiere interface failure", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="fatal-screen">
        <div className="fatal-mark"><img src="/brand/lmiere-mark-signal.svg" alt="Lmiere" /></div>
        <p>// Signal interrupted</p>
        <h1>The machine paused safely.</h1>
        <span>La machine s’est arrêtée en toute sécurité. Your account and credits have not been changed by this screen error.</span>
        <button type="button" onClick={() => window.location.reload()}>Reconnect / Recharger</button>
      </main>
    );
  }
}

const rootElement = document.getElementById("root");
const appRoot = rootElement.__lmiereReactRoot ?? createRoot(rootElement);
rootElement.__lmiereReactRoot = appRoot;

appRoot.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
