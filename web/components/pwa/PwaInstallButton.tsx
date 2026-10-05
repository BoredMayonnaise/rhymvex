"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Download,
  Loader2,
  Sparkles,
  X,
  Share,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __rvDeferredInstallPrompt?: BeforeInstallPromptEvent;
  }
}

/**
 * PWA Install & Download Engine
 *
 * Ensures 100% reliable installation and download experience across all mobile devices:
 * 1. Android Chrome / Edge / Samsung Internet: Native one-tap beforeinstallprompt trigger.
 * 2. iOS Safari (iPhone / iPad): Visual 2-step guide (Share -> Add to Home Screen) with icon callouts.
 * 3. iOS Chrome / Firefox / In-App: Clear guidance to open in Safari or download profile.
 * 4. Advanced fallback: Direct Apple mobileconfig profile download.
 * 5. Standalone detection: Automatically hides or indicates installed state if already running as PWA.
 */
export function PwaInstallButton({
  className = "",
  variant = "header",
  onAction,
}: {
  className?: string;
  variant?: "header" | "nav-item" | "inline";
  onAction?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Platform detection states
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== "undefined" && window.__rvDeferredInstallPrompt) {
      return window.__rvDeferredInstallPrompt;
    }
    return null;
  });

  useEffect(() => {
    setMounted(true);

    // 1. Standalone check
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Service Worker registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // 3. User agent & device checks
    const ua = navigator.userAgent || "";
    const isIosDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafariBrowser =
      isIosDevice &&
      /Safari/i.test(ua) &&
      !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
    const isAndroidDevice = /android/i.test(ua);

    setIsIos(isIosDevice);
    setIsSafari(isSafariBrowser);
    setIsAndroid(isAndroidDevice);

    const checkIsPhone = () => {
      return window.innerWidth <= 768 || window.matchMedia("(max-width: 768px)").matches;
    };
    const phone = checkIsPhone();
    setIsPhone(phone);

    // 4. Auto-popup modal on phone on first load if not dismissed
    if (phone) {
      const dismissed = sessionStorage.getItem("rv_pwa_download_dismissed");
      if (!dismissed) {
        const timer = setTimeout(() => {
          setShowModal(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }

    const handleResize = () => {
      setIsPhone(checkIsPhone());
    };
    window.addEventListener("resize", handleResize);

    // 5. Native prompt listeners
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__rvDeferredInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handlePwaReady = () => {
      if (window.__rvDeferredInstallPrompt) {
        setDeferredPrompt(window.__rvDeferredInstallPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__rvDeferredInstallPrompt = undefined;
      setShowModal(false);
    };

    // Custom event to trigger modal open from anywhere
    const handleOpenModal = () => {
      setShowModal(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("rv-pwa-ready", handlePwaReady);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("rv-open-pwa-install", handleOpenModal);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("rv-pwa-ready", handlePwaReady);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("rv-open-pwa-install", handleOpenModal);
    };
  }, []);

  // Native Install Prompt Trigger (Android Chrome)
  const triggerNativePrompt = useCallback(async () => {
    const promptEvent =
      deferredPrompt || (typeof window !== "undefined" ? window.__rvDeferredInstallPrompt : null);

    if (promptEvent) {
      setIsPrompting(true);
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setShowModal(false);
        }
      } catch (err) {
        console.warn("Native prompt cancelled or failed:", err);
      } finally {
        setIsPrompting(false);
        setDeferredPrompt(null);
        if (typeof window !== "undefined") {
          window.__rvDeferredInstallPrompt = undefined;
        }
      }
      return true;
    }
    return false;
  }, [deferredPrompt]);

  // Click on Download App button
  const handleButtonClick = async () => {
    onAction?.();

    // If native prompt is available immediately, fire it
    const promptEvent =
      deferredPrompt || (typeof window !== "undefined" ? window.__rvDeferredInstallPrompt : null);

    if (promptEvent) {
      const handled = await triggerNativePrompt();
      if (handled) return;
    }

    // Otherwise, open the tailored install sheet modal
    setShowModal(true);
  };

  const handleDismissModal = () => {
    setShowModal(false);
    sessionStorage.setItem("rv_pwa_download_dismissed", "true");
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (!mounted || isInstalled) {
    return null;
  }

  return (
    <>
      {/* 1. Header Button (Phone only) */}
      {variant === "header" && (
        <div className={`md:hidden ${className}`}>
          <button
            type="button"
            onClick={handleButtonClick}
            disabled={isPrompting}
            className="rv-btn rv-btn-primary rv-btn-sm w-full justify-center gap-2 font-semibold shadow-md active:scale-95 transition-all disabled:opacity-75"
            aria-label="Download App"
          >
            {isPrompting ? (
              <Loader2 className="size-4 animate-spin text-rhymvex-black" />
            ) : (
              <Download className="size-4 text-rhymvex-black" aria-hidden="true" />
            )}
            <span>{isPrompting ? "Installing..." : "Download App"}</span>
          </button>
        </div>
      )}

      {/* 2. Nav Item Variant (e.g. Mobile Dropdown Menu) */}
      {variant === "nav-item" && (
        <button
          type="button"
          onClick={handleButtonClick}
          className={`flex w-full items-center justify-between py-3 text-xs font-semibold uppercase tracking-wider text-rhymvex-volt transition-colors hover:text-rhymvex-white active:scale-98 ${className}`}
        >
          <span className="flex items-center gap-2">
            <Download className="size-4 text-rhymvex-volt" />
            <span>Download App</span>
          </span>
          <span className="rounded bg-rhymvex-volt/15 px-2 py-0.5 text-[10px] font-mono text-rhymvex-volt">
            Mobile PWA
          </span>
        </button>
      )}

      {/* 3. Dedicated Mobile Install Sheet Modal */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-modal-title"
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/85 p-4 backdrop-blur-md transition-opacity"
        >
          {/* Backdrop Click Dismiss */}
          <div
            className="absolute inset-0 cursor-default"
            onClick={handleDismissModal}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-sm rounded-2xl border border-rhymvex-volt/30 bg-[#0E131A] p-5 sm:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Close button */}
            <button
              type="button"
              onClick={handleDismissModal}
              className="absolute right-4 top-4 rounded-full p-1.5 text-rhymvex-white/50 hover:bg-rhymvex-white/10 hover:text-rhymvex-white transition-colors"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rhymvex-volt text-rhymvex-black shadow-lg shadow-rhymvex-volt/25">
                <Smartphone className="size-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0 pr-6">
                <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rhymvex-volt">
                  <Sparkles className="size-3" />
                  <span>Mobile App</span>
                </div>
                <h3 id="pwa-modal-title" className="text-base font-bold text-rhymvex-white">
                  Download Rhymvex App
                </h3>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-rhymvex-white/70">
              Install Rhymvex directly to your phone for instant, full-screen, offline-ready access from your home screen.
            </p>

            {/* ------------------------------------------------------------- */}
            {/* SCENARIO A: iOS / iPhone Instructions                         */}
            {/* ------------------------------------------------------------- */}
            {isIos ? (
              <div className="mt-4 flex flex-col gap-3">
                {isSafari ? (
                  <div className="rounded-xl border border-rhymvex-white/10 bg-rhymvex-black/60 p-3.5 text-xs text-rhymvex-white/80">
                    <p className="font-semibold text-rhymvex-volt mb-2.5 flex items-center gap-1.5">
                      <Sparkles className="size-3.5" />
                      <span>2 Easy Steps in Safari:</span>
                    </p>
                    <ol className="flex flex-col gap-2.5 text-xs leading-normal">
                      <li className="flex items-start gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rhymvex-volt/20 text-[11px] font-bold text-rhymvex-volt">
                          1
                        </span>
                        <span>
                          Tap the <span className="inline-flex items-center gap-1 rounded bg-rhymvex-white/10 px-1.5 py-0.5 font-semibold text-rhymvex-white"><Share className="size-3 text-rhymvex-volt" /> Share</span> icon in Safari&apos;s bottom toolbar.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rhymvex-volt/20 text-[11px] font-bold text-rhymvex-volt">
                          2
                        </span>
                        <span>
                          Scroll down and tap <span className="inline-flex items-center gap-1 rounded bg-rhymvex-white/10 px-1.5 py-0.5 font-semibold text-rhymvex-white"><PlusSquare className="size-3 text-rhymvex-volt" /> Add to Home Screen</span>.
                        </span>
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3.5 text-xs text-rhymvex-white/80">
                    <p className="font-semibold text-amber-300 mb-1.5 flex items-center gap-1.5">
                      <span>Open in Safari to Install</span>
                    </p>
                    <p className="text-rhymvex-white/70 leading-relaxed mb-2.5">
                      Apple requires Safari to add web apps to your iPhone home screen.
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="rv-btn rv-btn-ghost w-full justify-center gap-1.5 py-2 text-xs"
                    >
                      {isCopied ? (
                        <>
                          <Check className="size-3.5 text-rhymvex-volt" />
                          <span>Link Copied! Open Safari</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copy Link for Safari</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Direct Configuration Profile Alternative */}
                <div className="pt-1">
                  <a
                    href="/api/pwa/ios-profile"
                    download="rhymvex.mobileconfig"
                    className="flex items-center justify-between rounded-lg border border-rhymvex-white/8 bg-rhymvex-slate/40 px-3 py-2 text-[11px] text-rhymvex-white/60 hover:text-rhymvex-white hover:border-rhymvex-volt/30 transition-all"
                  >
                    <span>Alternative: Direct iOS Profile (.mobileconfig)</span>
                    <Download className="size-3 text-rhymvex-volt" />
                  </a>
                </div>
              </div>
            ) : isAndroid ? (
              /* ------------------------------------------------------------- */
              /* SCENARIO B: Android Device                                    */
              /* ------------------------------------------------------------- */
              <div className="mt-4 flex flex-col gap-3">
                {deferredPrompt ? (
                  <button
                    type="button"
                    onClick={triggerNativePrompt}
                    disabled={isPrompting}
                    className="rv-btn rv-btn-primary w-full justify-center gap-2 py-3 text-sm font-bold shadow-md active:scale-95 transition-all disabled:opacity-75"
                  >
                    {isPrompting ? (
                      <Loader2 className="size-4 animate-spin text-rhymvex-black" />
                    ) : (
                      <Download className="size-4" aria-hidden="true" />
                    )}
                    <span>{isPrompting ? "Installing..." : "Install Rhymvex App"}</span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-rhymvex-white/10 bg-rhymvex-black/60 p-3.5 text-xs text-rhymvex-white/80">
                    <p className="font-semibold text-rhymvex-volt mb-2 flex items-center gap-1.5">
                      <Sparkles className="size-3.5" />
                      <span>Install via Chrome / Android:</span>
                    </p>
                    <ol className="flex flex-col gap-2 text-xs leading-normal">
                      <li className="flex items-start gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rhymvex-volt/20 text-[11px] font-bold text-rhymvex-volt">
                          1
                        </span>
                        <span>
                          Tap the <span className="inline-flex items-center gap-1 rounded bg-rhymvex-white/10 px-1.5 py-0.5 font-semibold text-rhymvex-white"><MoreVertical className="size-3 text-rhymvex-volt" /> menu</span> in top right.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rhymvex-volt/20 text-[11px] font-bold text-rhymvex-volt">
                          2
                        </span>
                        <span>
                          Select <span className="font-semibold text-rhymvex-volt">&quot;Install app&quot;</span> or <span className="font-semibold text-rhymvex-volt">&quot;Add to Home screen&quot;</span>.
                        </span>
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              /* ------------------------------------------------------------- */
              /* SCENARIO C: Other / Desktop / Fallback                        */
              /* ------------------------------------------------------------- */
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-xl border border-rhymvex-white/10 bg-rhymvex-black/60 p-3.5 text-xs text-rhymvex-white/80">
                  <p className="font-semibold text-rhymvex-volt mb-1.5">Install App to Home Screen</p>
                  <p className="text-rhymvex-white/70 leading-relaxed">
                    Open your browser menu (⋮ or Share) and select &quot;Install app&quot; or &quot;Add to Home screen&quot; to run Rhymvex standalone.
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Dismiss Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleDismissModal}
                className="rv-btn rv-btn-ghost w-full justify-center py-2 text-xs text-rhymvex-white/60 hover:text-rhymvex-white"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
