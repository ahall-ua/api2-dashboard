"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";

const GEOCITIES_CSS = `
  html.geocities, html.geocities body {
    background:
      repeating-linear-gradient(45deg,
        #ff00ff 0 24px,
        #00ffff 24px 48px,
        #ffff00 48px 72px,
        #00ff00 72px 96px) !important;
    font-family: "Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive !important;
    color: #ffff66 !important;
    cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><text y='18' font-size='18'>✨</text></svg>") 0 0, auto !important;
  }
  html.geocities * { font-family: inherit !important; }
  html.geocities main {
    background: rgba(0, 0, 64, 0.92) !important;
    border: 8px ridge #ff00ff !important;
    box-shadow: 0 0 40px #ff00ff, inset 0 0 20px #ffff00 !important;
    margin: 16px !important;
    border-radius: 0 !important;
  }
  html.geocities header { background: linear-gradient(90deg, #ff00ff, #00ffff, #ffff00) !important; border-bottom: 4px solid #00ff00 !important; }
  html.geocities a { color: #00ffff !important; text-decoration: underline !important; }
  html.geocities a:visited { color: #ff66ff !important; }
  html.geocities button, html.geocities .geo-badge {
    border: 2px outset #c0c0c0 !important;
    background: linear-gradient(180deg, #d0d0d0, #808080) !important;
    color: #000 !important;
    padding: 4px 10px !important;
    border-radius: 0 !important;
    font-weight: bold !important;
  }
  html.geocities table, html.geocities tr, html.geocities td, html.geocities th {
    border-color: #ff00ff !important;
  }

  /* Top is just the marquee. The under-construction signs + visitor
     counter sit in their own row beneath, taking up the otherwise-empty
     space above the main content. */
  .geo-top {
    padding: 4px 8px;
  }
  .geo-band {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 12px 24px;
    margin: 8px 0;
  }
  .geo-band-center {
    flex: 1;
    text-align: center;
    color: #ffffff;
    text-shadow: 1px 1px 0 #000;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }
  .geo-band-center .label { color: #00ff00; font-weight: bold; margin-right: 8px; }
  .geo-band-center .last-updated { color: #ffff00; }
  .geo-band-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; align-items: center; }
  .geo-marquee-wrap {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    background: black;
    border-top: 2px solid #00ff00;
    border-bottom: 2px solid #00ff00;
    padding: 4px 0;
    font-size: 14px;
    font-weight: bold;
    color: #00ff00;
  }
  .geo-marquee {
    display: inline-block;
    padding-left: 100%;
    animation: geo-marquee 18s linear infinite;
  }
  @keyframes geo-marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-100%); }
  }
  .geo-blink { animation: geo-blink 1s steps(2) infinite; }
  @keyframes geo-blink { 50% { opacity: 0; } }
  .geo-rainbow {
    font-weight: bold;
    text-shadow: 2px 2px 0 #000, 3px 3px 0 #ff0000;
    animation: geo-rainbow 2s linear infinite;
  }
  @keyframes geo-rainbow {
    0%   { color: #ff0000; }
    16%  { color: #ff8800; }
    33%  { color: #ffff00; }
    50%  { color: #00ff00; }
    66%  { color: #00ffff; }
    83%  { color: #6600ff; }
    100% { color: #ff00ff; }
  }
  .geo-badges { margin: 8px 0; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .geo-pulse { display: inline-block; animation: geo-pulse 0.8s ease-in-out infinite alternate; }
  @keyframes geo-pulse { to { transform: scale(1.4); } }
  .geo-stars {
    position: fixed; pointer-events: none; inset: 0; z-index: 9999;
    background-image:
      radial-gradient(2px 2px at 20px 30px, #fff, transparent),
      radial-gradient(2px 2px at 60px 70px, #ff0, transparent),
      radial-gradient(2px 2px at 50px 160px, #f0f, transparent),
      radial-gradient(2px 2px at 90px 40px, #0ff, transparent),
      radial-gradient(2px 2px at 130px 80px, #fff, transparent),
      radial-gradient(2px 2px at 170px 130px, #ff0, transparent);
    background-size: 200px 200px;
    animation: geo-twinkle 1.4s steps(2) infinite;
    opacity: 0.6;
  }
  @keyframes geo-twinkle { 50% { opacity: 0.1; } }

  .geo-roll {
    display: inline-flex;
    gap: 2px;
    background: black;
    border: 2px inset #c0c0c0;
    padding: 3px;
    box-shadow: inset 0 0 10px rgba(0,255,0,0.3);
  }
  .geo-roll-cell {
    display: inline-block;
    width: 16px;
    height: 22px;
    overflow: hidden;
    background: #001500;
    border: 1px solid #003300;
    position: relative;
  }
  .geo-roll-strip {
    display: flex;
    flex-direction: column;
    transition: transform 0.6s cubic-bezier(0.25, 1.5, 0.4, 1);
    color: #00ff44;
    font-family: "Courier New", "Lucida Console", monospace !important;
    font-weight: bold;
    font-size: 16px;
    line-height: 22px;
    text-align: center;
    text-shadow: 0 0 3px #00ff44;
  }
  .geo-roll-strip > span { height: 22px; flex: 0 0 22px; }

  .geo-construction-sign {
    display: inline-block;
    vertical-align: middle;
    image-rendering: pixelated;
  }
`;

function ConstructionSign({ src = "/under-construction.gif", width = 220 }: { src?: string; width?: number }) {
  return (
    <img
      src={src}
      alt="Under Construction"
      className="geo-construction-sign"
      width={width}
    />
  );
}

function RollingDigit({ digit }: { digit: number }) {
  return (
    <span className="geo-roll-cell">
      <span className="geo-roll-strip" style={{ transform: `translateY(-${digit * 22}px)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </span>
    </span>
  );
}

function RollingCounter({ value, digits = 7 }: { value: number; digits?: number }) {
  const padded = String(value).padStart(digits, "0");
  return (
    <span className="geo-roll">
      {padded.split("").map((d, i) => (
        <RollingDigit key={i} digit={Number(d)} />
      ))}
    </span>
  );
}

function GeocitiesEffectInner() {
  const searchParams = useSearchParams();
  const enabled = searchParams.get("geocities") === "1";
  const initialVisitors = useMemo(() => 19980000 + Math.floor(Math.random() * 90000 + 10000), []);
  const [visitors, setVisitors] = useState(initialVisitors);

  useEffect(() => {
    if (enabled) document.documentElement.classList.add("geocities");
    else document.documentElement.classList.remove("geocities");
    return () => document.documentElement.classList.remove("geocities");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      setVisitors((v) => v + 1 + Math.floor(Math.random() * 3));
    }, 2500);
    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <style>{GEOCITIES_CSS}</style>
      <div className="geo-stars" aria-hidden />
      <div className="geo-top">
        <div className="geo-marquee-wrap">
          <span className="geo-marquee">
            ★彡 WELCOME TO MY HOMEPAGE!!! 彡★ &nbsp;&nbsp;&nbsp; SIGN MY GUESTBOOK!!! 彡★ &nbsp;&nbsp;&nbsp; WELCOME TO MY HOMEPAGE!!! 彡★ &nbsp;&nbsp;&nbsp; SIGN MY GUESTBOOK!!! 彡★
          </span>
        </div>
      </div>
      <div className="geo-band">
        <ConstructionSign src="/under-construction.gif" width={260} />
        <div className="geo-band-center">
          <div className="geo-band-row" style={{ fontSize: 14 }}>
            <span className="label">VISITORS</span>
            <RollingCounter value={visitors} digits={7} />
            <span style={{ marginLeft: 12 }}>
              Last updated: <span className="last-updated">04/21/1998</span>
            </span>
          </div>
          <div className="geo-band-row">
            <span className="geo-badge">📺 Best viewed in Netscape</span>
            <span className="geo-badge">🌐 Made with HTML 4.0</span>
            <span className="geo-badge">
              <span className="geo-pulse">📧</span> sign my guestbook!
            </span>
          </div>
          <div className="geo-rainbow" style={{ fontSize: 14 }}>
            ~ * ~ THANKS FOR VISITING ~ * ~
          </div>
        </div>
        <ConstructionSign src="/under-construction-2.gif" width={180} />
      </div>
    </>
  );
}

export function GeocitiesEffect() {
  return (
    <Suspense>
      <GeocitiesEffectInner />
    </Suspense>
  );
}
