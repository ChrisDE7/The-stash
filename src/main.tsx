import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, ArrowDown, Menu, X } from "lucide-react";
import { configured, db, defaults, query } from "./api";
import { Cover, Empty, EntryDetail } from "./ui";
import { safeUrl } from "./validation.js";
import type { Entry, Settings } from "./types";
import Admin from "./admin";
import "./style.css";
function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/"),
    [settings, setSettings] = useState<Settings>(defaults),
    [entries, setEntries] = useState<Entry[]>([]),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("All"),
    [menu, setMenu] = useState(false);
  const isAdmin = route.startsWith("/admin");
  async function refresh() {
    if (!db) return;
    try {
      const [rows, site] = await Promise.all([
        query(
          db
            .from("published_entries")
            .select("content")
            .order("updated_at", { ascending: false }),
        ),
        query(db.from("site_settings").select("content").eq("id", 1).single()),
      ]);
      setEntries(rows.map((r) => r.content));
      if (site) setSettings(site.content);
      setError("");
    } catch {
      setError("The collection is temporarily unavailable. Please try again.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const routeChanged = () => {
      if (location.hash === "#content") {
        document.getElementById("content")?.focus();
        return;
      }
      if (route.startsWith("/admin")) {
        const leave = new CustomEvent("stash-leave", { cancelable: true });
        if (!window.dispatchEvent(leave)) {
          history.replaceState(null, "", "#" + route);
          return;
        }
      }
      setRoute(location.hash.slice(1) || "/");
      setFilter("All");
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", routeChanged);
    return () => window.removeEventListener("hashchange", routeChanged);
  }, [route]);
  useEffect(() => {
    if (isAdmin) return;
    refresh();
    const id = setInterval(refresh, 30000);
    const focus = () => refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", focus);
    };
  }, [isAdmin]);
  useEffect(() => {
    document.title = settings.title + " — Chris / Unturned creator";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", settings.description);
  }, [settings]);
  if (isAdmin) return <Admin />;
  const current = route.startsWith("/work/")
    ? entries.find((e) => e.id === route.split("/")[2])
    : undefined;
  const plugins = route === "/plugins",
    work = route === "/work",
    about = route === "/about",
    home = route === "/";
  const cards = (items: Entry[]) => (
    <div className="cards">
      {items.map((e, i) => (
        <a className="work-card" key={e.id} href={"#/work/" + e.id}>
          <div className="card-media">
            <Cover entry={e} />
            <span className="card-index">{String(i + 1).padStart(2, "0")}</span>
            <span className="card-arrow">
              <ArrowUpRight size={24} />
            </span>
          </div>
          <div className="card-meta">
            <span>{e.category || e.kind}</span>
            <span>{e.kind === "plugin" ? "Plugin" : "Project"}</span>
          </div>
          <h3>{e.title}</h3>
          {e.summary && <p>{e.summary}</p>}
          {e.tags.length > 0 && (
            <div className="tags">
              {e.tags.map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
          )}
        </a>
      ))}
    </div>
  );
  const collection = (items: Entry[], title: string) => (
    <section className="collection">
      <div className="section-heading">
        <div>
          <span className="eyebrow">The collection</span>
          <h2>
            {title}
            <span className="count">
              {items.length.toString().padStart(2, "0")}
            </span>
          </h2>
        </div>
        {home && (
          <a className="text-link" href="#/work">
            Explore all work <ArrowUpRight size={18} />
          </a>
        )}
      </div>
      {items.length > 0 && (
        <>
          <div className="filters" aria-label="Categories">
            {[
              "All",
              ...settings.categories.filter((c) =>
                items.some((e) => e.category === c),
              ),
            ].map((c) => (
              <button
                key={c}
                aria-pressed={filter === c}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {cards(
            items.filter((e) => filter === "All" || e.category === filter),
          )}
        </>
      )}
      {!loading && !error && !items.length && (
        <Empty
          title={
            plugins ? "Plugins are on the way." : "A collection in the making."
          }
        >
          <p>
            {plugins
              ? "Plugin details will appear here when published."
              : "New work will appear here when it is ready to share."}
          </p>
          <a className="text-link" href="#/about">
            Get in touch <ArrowUpRight size={16} />
          </a>
        </Empty>
      )}
    </section>
  );
  return (
    <>
      <a
        className="skip"
        href="#content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("content")?.focus();
          document.getElementById("content")?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-mark">
            S<span>·</span>
          </span>
          <span>
            {settings.title}
            <small>CHRIS / CREATOR</small>
          </span>
        </a>
        <button
          className="menu-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav className={menu ? "open" : ""} aria-label="Main navigation">
          <a href="#/work" aria-current={work ? "page" : undefined}>
            Work
          </a>
          <a href="#/plugins" aria-current={plugins ? "page" : undefined}>
            Plugins
          </a>
          <a href="#/about" aria-current={about ? "page" : undefined}>
            About & contact <ArrowUpRight size={14} />
          </a>
        </nav>
      </header>
      <main id="content" className="shell" tabIndex={-1}>
        {home && (
          <section className="hero">
            <div className="hero-top">
              <span className="eyebrow">
                <span className="dot" /> Independent creator
              </span>
              <span className="edition">UNTURNED & BEYOND</span>
            </div>
            <h1>
              A place for
              <br />
              everything I <em>build.</em>
            </h1>
            <div className="hero-bottom">
              <p>{settings.intro}</p>
              <a className="button primary" href="#/work">
                View my work <ArrowDown size={18} />
              </a>
            </div>
            <div className="hero-rule">
              <span>THE STASH</span>
              <span>MAPS · PLUGINS · CREATIVE WORK</span>
              <span>BY CHRIS</span>
            </div>
          </section>
        )}
        {!configured && (
          <p className="notice">
            Preview only — the content service has not been connected. The
            existing live site has not been replaced.
          </p>
        )}
        {loading && (
          <p className="loading" role="status">
            Opening the collection…
          </p>
        )}
        {error && (
          <div className="notice" role="alert">
            {error} <button onClick={refresh}>Try again</button>
          </div>
        )}
        {home &&
          settings.featured.some((id) => entries.some((e) => e.id === id)) &&
          collection(
            settings.featured
              .map((id) => entries.find((e) => e.id === id))
              .filter(Boolean) as Entry[],
            "Selected work",
          )}
        {home &&
          !settings.featured.some((id) => entries.some((e) => e.id === id)) &&
          collection(entries, "Latest work")}
        {work &&
          collection(
            entries.filter((e) => e.kind === "project"),
            "Projects & worlds",
          )}
        {plugins &&
          collection(
            entries.filter((e) => e.kind === "plugin"),
            "Plugins",
          )}
        {current && (
          <>
            <a
              className="back-link"
              href={current.kind === "plugin" ? "#/plugins" : "#/work"}
            >
              ← Back to {current.kind === "plugin" ? "plugins" : "work"}
            </a>
            <EntryDetail entry={current} />
          </>
        )}
        {about && (
          <section className="about">
            <span className="eyebrow">Behind the stash</span>
            <h1>Hi, I’m Chris.</h1>
            <p className="lead">{settings.about}</p>
            <div className="contact-block">
              <div>
                <span className="eyebrow">Have something in mind?</span>
                <h2>Let’s build.</h2>
                <p>{settings.contactIntro}</p>
              </div>
              <div className="contact-links">
                {settings.links
                  .filter((l) => l.label && safeUrl(l.url))
                  .map((l, i) => (
                    <a
                      key={i}
                      href={safeUrl(l.url)!}
                      target={l.url.startsWith("https:") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                    >
                      {l.label}
                      <ArrowUpRight />
                    </a>
                  ))}
                {settings.discord && (
                  <div className="discord">
                    <span>Discord</span>
                    <strong>{settings.discord}</strong>
                    <button
                      onClick={async (e) => {
                        const b = e.currentTarget;
                        try {
                          await navigator.clipboard.writeText(settings.discord);
                          b.textContent = "Copied";
                        } catch {
                          b.textContent = "Select the username to copy";
                        }
                      }}
                    >
                      Copy username
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        {!home && !work && !plugins && !about && !current && !loading && (
          <Empty title="This page isn’t available.">
            <p>It may have been unpublished.</p>
            <a href="#/">Back to the stash</a>
          </Empty>
        )}
      </main>
      <footer className="shell footer">
        <a className="brand" href="#/">
          {settings.title}
          <span className="muted"> / Chris</span>
        </a>
        <span>Made for the things worth making.</span>
        <a href="#/admin">
          Owner sign in <ArrowUpRight size={14} />
        </a>
      </footer>
    </>
  );
}
class Boundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="shell">
        <h1>Something went wrong.</h1>
        <p>
          Please reload the page. If this happened while editing, avoid closing
          the tab until you have copied any unsaved text.
        </p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
