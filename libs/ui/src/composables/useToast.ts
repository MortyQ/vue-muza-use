import { toast } from "vue-sonner";

/**
 * Custom toast composable with project styling
 * Uses vue-sonner under the hood
 */
export const useToast = () => {
  const success = (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 4000,
    });
  };

  const error = (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 5000,
    });
  };

  const warning = (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4000,
    });
  };

  const info = (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 4000,
    });
  };

  const promise = <T>(
    promise: Promise<T>,
    options: {
      loading: string

      success: string | ((data: T) => string)

      error: string | ((error: Error) => string)
    },
  ) => {
    return toast.promise(promise, options);
  };

  const custom = (message: string, options?: Record<string, unknown>) => {
    return toast(message, options);
  };

  const dismiss = (toastId?: string | number) => {
    toast.dismiss(toastId);
  };

  return {
    success,
    error,
    warning,
    info,
    promise,
    custom,
    dismiss,
  };
};
