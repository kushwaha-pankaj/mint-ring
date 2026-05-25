"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  clearDesignSession,
  isStudioWorkspacePath,
} from "@/lib/studio-session";

/**
 * Clears the design localStorage session when leaving /design or /try-on so the
 * next visit starts fresh. Gallery retains every generation on the server.
 */
export function StudioSessionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    const previous = prevPath.current;
    prevPath.current = pathname;

    if (!previous || previous === pathname) return;

    const leftWorkspace =
      isStudioWorkspacePath(previous) && !isStudioWorkspacePath(pathname);
    const switchedWorkspace =
      isStudioWorkspacePath(previous) &&
      isStudioWorkspacePath(pathname) &&
      previous !== pathname;

    if (leftWorkspace || switchedWorkspace) {
      clearDesignSession();
    }
  }, [pathname]);

  return <>{children}</>;
}
