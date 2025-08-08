import { useEffect, useState } from "react";
import NotSupportedBrowser from "./NotSupportedBrowser";
import ScriptVault from "./ScriptVault";

export default function App() {
  const [isSupportedBrowser, setIsSupportedBrowser] = useState<boolean>(true)

  useEffect(() => {
      const checkBrowser = async () => {
        try {
          // Detect support: require File System Access API and Chromium
          const isChromium = !!(navigator as unknown).userAgentData?.brands?.some((b: unknown) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand)) || /Chrome|Edg\//.test(navigator.userAgent) && !/Firefox|Safari\//.test(navigator.userAgent);
          const hasFS = typeof window !== "undefined" && "showDirectoryPicker" in window;
          setIsSupportedBrowser(isChromium && hasFS);
        } catch (e) {
          // ignore
        }
      }
      checkBrowser()
    }, [])


    if (!isSupportedBrowser) {
      return <NotSupportedBrowser/>
    }

    return <ScriptVault/>
}