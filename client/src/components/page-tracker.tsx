import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trackPageView } from "@/lib/analytics";

function getVisitorId(): string {
  let id = localStorage.getItem("ebgz_visitor_id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("ebgz_visitor_id", id);
  }
  return id;
}

function getSessionId(): string {
  let id = sessionStorage.getItem("ebgz_session_id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("ebgz_session_id", id);
  }
  return id;
}

function getCustomerEmail(): string | null {
  try {
    const raw = localStorage.getItem("ebgz_customer");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj?.email || null;
  } catch {
    return null;
  }
}

export function PageTracker() {
  const [location] = useLocation();
  const lastTracked = useRef("");
  const pageStartTime = useRef(Date.now());

  useEffect(() => {
    if (location === lastTracked.current) return;

    const prevPath = lastTracked.current;
    const prevTimeOnPage = prevPath
      ? Math.round((Date.now() - pageStartTime.current) / 1000)
      : null;

    lastTracked.current = location;
    pageStartTime.current = Date.now();

    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const customerEmail = getCustomerEmail();

    trackPageView(location);

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: location,
        visitorId,
        sessionId,
        referrer: document.referrer || null,
        customerEmail: customerEmail || undefined,
        prevPath: prevPath || undefined,
        prevTimeOnPage: prevTimeOnPage && prevTimeOnPage > 0 ? prevTimeOnPage : undefined,
      }),
    }).catch(() => {});
  }, [location]);

  // Send time-on-page when tab closes or hides (last page in session)
  useEffect(() => {
    const sendExit = () => {
      const timeSpent = Math.round((Date.now() - pageStartTime.current) / 1000);
      if (timeSpent < 2 || !lastTracked.current) return;
      const visitorId = getVisitorId();
      const payload = JSON.stringify({
        path: lastTracked.current,
        visitorId,
        timeOnPage: timeSpent,
      });
      try {
        navigator.sendBeacon("/api/track/exit", new Blob([payload], { type: "application/json" }));
      } catch {
        // sendBeacon not available — skip silently
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") sendExit();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", sendExit);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", sendExit);
    };
  }, []);

  return null;
}
