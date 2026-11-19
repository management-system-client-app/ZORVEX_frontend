import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

type ToastNotice = {
  type: "success" | "error";
  message: string;
  login?: boolean;
};

type ToastEventDetail = ToastNotice;

type LoginToast = ToastNotice & { id: number };
let nextToastId = 0;

export function ToastViewport() {
  const [loginToasts, setLoginToasts] = useState<LoginToast[]>([]);

  useEffect(() => {
    const showToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      if (!detail?.message) return;
      if (detail.login) {
        const id = ++nextToastId;
        setLoginToasts((current) => [...current.slice(-2), { ...detail, id }]);
        window.setTimeout(() => {
          setLoginToasts((current) => current.filter((toast) => toast.id !== id));
        }, 4000);
        return;
      }
      void Swal.fire({
        icon: detail.type === "error" ? "error" : "success",
        text: detail.message,
        confirmButtonText: "OK",
      });
    };

    window.addEventListener("app:toast", showToast);
    return () => window.removeEventListener("app:toast", showToast);
  }, []);

  return loginToasts.length ? (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {loginToasts.map((toast) => (
        <div className={`app-toast app-toast-${toast.type}`} key={toast.id} role={toast.type === "error" ? "alert" : "status"}>
          <span aria-hidden="true">{toast.type === "success" ? "✓" : "!"}</span>
          <p>{toast.message}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setLoginToasts((current) => current.filter((item) => item.id !== toast.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  ) : null;
}
