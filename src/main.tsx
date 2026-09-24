import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { configured, db, defaults, query } from "./api";
import { Cover, Empty, EntryDetail } from "./ui";
import { safeUrl } from "./validation.js";
import type { Entry, Settings } from "./types";
const Admin = lazy(() => import("./admin"));
import Atmosphere from "./atmosphere";
import { Community } from "./community";
import { recordActivity } from "./activity";
import "./style.css";
import "./portfolio.css";
function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/"),
    [settings, setSettings] = useState<Settings>(defaults),
    [entries, setEntries] = useState<Entry[]>([]),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState(""),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [menu, setMenu] = useState(false);
  const isAdmin = route.startsWith("/admin");
  useEffect(() => {
    if (isAdmin) return;
    void recordActivity('visit');
    const id = route.startsWith('/work/') ? route.split('/')[2] : '';
    if (id && entries.some(e => e.id === id)) void recordActivity('project', id);
  }, [route, isAdmin, entries]);
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
      setFilters({});
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
  if (isAdmin) return <Suspense fallback={<main className="login" role="status">Opening your workspace…</main>}><Admin /></Suspense>;
  const current = route.startsWith("/work/")
    ? entries.find((e) => e.id === route.split("/")[2])
    : undefined;
  const plugins = route === "/plugins",
    maps = route === "/maps" || route === "/work",
    about = route === "/about",
    home = route === "/";
  const isMap = (e: Entry) => e.kind === "project";
  const cards = (items: Entry[]) => (
    <div className="cards">
      {[...items].sort((a, b) => {
        if (!home) return 0;
        const rank = (id: string) => {
          const index = settings.featured.indexOf(id);
          return index < 0 ? Number.MAX_SAFE_INTEGER : index;
        };
        return rank(a.id) - rank(b.id);
      }).map((e, i) => (
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
          <a className="text-link" href={title === "Unturned Maps" ? "#/maps" : "#/plugins"}>
            {title === "Unturned Maps" ? "Explore all maps" : "Explore all plugins"} <ArrowUpRight size={18} />
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
                aria-pressed={(filters[title] || "All") === c}
                onClick={() => setFilters((previous) => ({ ...previous, [title]: c }))}
              >
                {c}
              </button>
            ))}
          </div>
          {cards(
            items.filter((e) => !filters[title] || filters[title] === "All" || e.category === filters[title]),
          )}
        </>
      )}
      {!loading && !error && !items.length && (
        <Empty
          title={
            title === "Unturned Plugins" ? "Plugins are on the way." : maps || title === "Unturned Maps" ? "New worlds are taking shape." : "A collection in the making."
          }
        >
          <p>
            {title === "Unturned Plugins"
              ? "Plugin details will appear here when published."
              : maps || title === "Unturned Maps" ? "Map screenshots, places to explore, and build details will appear here as they are shared." : "New work will appear here when it is ready to share."}
          </p>
          <a className="text-link" href="#/about">
            Get in touch <ArrowUpRight size={16} />
          </a>
        </Empty>
      )}
    </section>
  );
  return (
    <div className="public-site">
      <Atmosphere />
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
            C
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
          aria-controls="main-navigation"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav id="main-navigation" className={menu ? "open" : ""} aria-label="Main navigation">
          <a href="#/" aria-current={home ? "page" : undefined}>Home</a>
          <a href="#/maps" aria-current={maps ? "page" : undefined}>Unturned Maps</a>
          <a href="#/plugins" aria-current={plugins ? "page" : undefined}>
            Unturned Plugins
          </a>
          <a href="#/about" aria-current={about ? "page" : undefined}>
            About & contact <ArrowUpRight size={14} />
          </a>
        </nav>
      </header>
      <main id="content" className="shell" tabIndex={-1}>
        {home && (
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow"><span className="dot" /> CHRIS / INDEPENDENT CREATOR</span>
              <h1>Small details.<br /><em>Whole worlds.</em></h1>
              <p>{settings.intro}</p>
              <div className="hero-actions">
                <a className="button primary" href="#/maps">Explore maps <ArrowUpRight size={18} /></a>
                <a className="button" href="#/plugins">Explore plugins <ArrowUpRight size={18} /></a>
              </div>

            </div>
            <div className="creator-panel" aria-label="Chris creator emblem">
              <div className="panel-caption"><span>THE STASH</span><span>BY CHRIS</span></div>
              <div className="creator-emblem" aria-hidden="true">C</div>
              <div className="creator-focus"><span>THE CREATIVE SIDE OF UNTURNED</span><strong>Built one detail at a time.</strong></div>
            </div>
          </section>
        )}
        {(maps || plugins) && (
          <section className="page-intro">
            <span className="eyebrow">{maps ? "Explore the worlds" : plugins ? "Tools for your server" : "Ideas made real"}</span>
            <h1>{maps ? "Places worth exploring." : plugins ? "Small tools. More possibilities." : "A little of everything I build."}</h1>
            <p>{maps ? "Unturned environments, from the big picture to the smallest detail. Explore screenshots and the stories behind each map." : plugins ? "Plugins and experiments for Unturned, with features, previews, and useful links in one place." : "Unturned maps and plugins, collected here as they take shape."}</p>
          </section>
        )}
        {!configured && (
          <p className="notice">
            Design preview · Project galleries are being prepared.
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
        {home && collection(entries.filter(isMap), "Unturned Maps")}
        {home && collection(entries.filter((e) => e.kind === "plugin"), "Unturned Plugins")}
        {home && <section className="contact-banner"><div><span className="eyebrow">Have a project in mind?</span><h2>Let’s make something worth exploring.</h2></div><a className="button primary" href="#/about">Get in touch <ArrowUpRight size={18} /></a></section>}
        {maps && collection(entries.filter(isMap), "Unturned Maps")}
        {plugins &&
          collection(
            entries.filter((e) => e.kind === "plugin"),
            "Unturned Plugins",
          )}
        {current && (
          <>
            <a
              className="back-link"
              href={current.kind === "plugin" ? "#/plugins" : isMap(current) ? "#/maps" : "#/work"}
            >
              ← Back to {current.kind === "plugin" ? "plugins" : isMap(current) ? "maps" : "projects"}
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
        {!home && !maps && !plugins && !about && !current && !loading && (
          <Empty title="This page isn’t available.">
            <p>It may have been unpublished.</p>
            <a href="#/">Back to the stash</a>
          </Empty>
        )}
        {home && <Community settings={settings} />}
      </main>
      <footer className="shell footer">
        <a className="brand" href="#/">
          {settings.title}
          <span className="muted"> / Chris</span>
        </a>
        <span>Made for the things worth making.</span>

      </footer>
    </div>
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
