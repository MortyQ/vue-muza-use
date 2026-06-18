import { isAxiosError } from "axios";
import type { ApiError } from "../types";

export function parseApiError(error: unknown): ApiError {
    if (isAxiosError(error)) {
        const axiosError = error;
        if (axiosError.response) {
            const { data, status } = axiosError.response;

            const message =
                data?.message ||
                data?.error ||
                axiosError.message ||
                "Unknown Error";

            return {
                message,
                status,
                code: data?.code,
                errors: data?.errors,
                details: data,
            };
        }

        // Network / timeout / CORS — no response body, but preserve the axios error code
        return {
            message: axiosError.message,
            status: 0,
            code: axiosError.code,
        };
    }

    return {
        message: error instanceof Error ? error.message : String(error),
        status: 0,
    };
}
