"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Id } from "@/lib/convex";
import { ProgressToast } from "@/components/ui/progress-toast";
import { toast } from "sonner";

export function useProgressToast() {
  const toastIds = useRef<Map<string, string>>(new Map());
  const router = useRouter();

  const showProgressToast = useCallback((taskId: Id<"tasks">, title: string) => {
    const taskKey = taskId;
    
    // Check if we already have a toast for this task
    if (toastIds.current.has(taskKey)) {
      return; // Don't create duplicate toasts
    }

    const handleView = (taskId: Id<"tasks">) => {
      // Navigate to tasks page with taskId to open the dialog
      router.push(`/tasks?taskId=${taskId}`);
    };

    const handleDismiss = (toastId: string) => {
      toast.dismiss(toastId);
      toastIds.current.delete(taskKey);
    };

    // Create a new toast with the progress component
    const toastId = toast(
      <ProgressToast 
        taskId={taskId} 
        title={title} 
        toastId={taskKey}
      />,
      {
        duration: Infinity, // Keep it open until manually dismissed
        dismissible: true,
        id: taskKey, // Use task ID as toast ID for uniqueness
        action: {
          label: "View",
          onClick: () => handleView(taskId),
        },
        cancel: {
          label: "Dismiss",
          onClick: () => handleDismiss(taskKey),
        },
      }
    );

    toastIds.current.set(taskKey, String(toastId));
  }, [router]);

  const dismissProgressToast = useCallback((taskId: Id<"tasks">) => {
    const taskKey = taskId;
    const toastId = toastIds.current.get(taskKey);
    
    if (toastId) {
      toast.dismiss(toastId);
      toastIds.current.delete(taskKey);
    }
  }, []);

  // Cleanup function to dismiss all progress toasts
  const dismissAllProgressToasts = useCallback(() => {
    toastIds.current.forEach((toastId) => {
      toast.dismiss(toastId);
    });
    toastIds.current.clear();
  }, []);

  return {
    showProgressToast,
    dismissProgressToast,
    dismissAllProgressToasts
  };
}
