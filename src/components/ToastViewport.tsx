import { useEffect, useState } from "react";

type ToastNotice = {
  id: number;
  type: "success" | "error";
  message: string;
};

type ToastEventDetail = Omit<ToastNotice, "id">;

let nextToastId = 0;

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  useEffect(() => {
    const showToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      if (!detail?.message) return;
      const id = ++nextToastId;
      setToasts((current) => [...current.slice(-3), { ...detail, id }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4000);
    };

    window.addEventListener("app:toast", showToast);
    return () => window.removeEventListener("app:toast", showToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div className={`app-toast app-toast-${toast.type}`} key={toast.id} role={toast.type === "error" ? "alert" : "status"}>
          <span aria-hidden="true">{toast.type === "success" ? "✓" : "!"}</span>
          <p>{toast.message}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
