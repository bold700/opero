"use client";

import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      closeButton
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-zinc-200 bg-white text-zinc-950 shadow-lg",
        },
      }}
    />
  );
}

export { Toaster };
