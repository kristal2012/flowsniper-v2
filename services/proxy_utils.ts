
/**
 * Mock Proxy Utils
 * Created to bypass missing file error in diagnosis/headless bot.
 */
export const proxyManager = {
    async validateConnection(): Promise<boolean> {
        console.log("[ProxyMock] Validating connection (Always True)");
        return true;
    },

    async proxyFetch(url: string, options?: any): Promise<Response> {
        // Just use direct fetch since we don't have the real proxy logic
        // If the user has a proxy set in ENV, this might not use it, but it allows the code to run.
        if (process.env.VITE_PROXY_ENABLED === 'true') {
            console.warn(`[ProxyMock] Proxy is enabled in ENV but utilizing Direct Fetch in Mock.`);
        }
        return fetch(url, options);
    }
};
