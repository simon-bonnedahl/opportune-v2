// Provider to logo mapping utility
export const getProviderLogo = (provider: string) => {
  const logoMap: Record<string, { src: string; alt: string }> = {
    "OpenAI": { src: "/images/openai_logo.webp", alt: "OpenAI" },
    "Google": { src: "/images/google_logo.webp", alt: "Google" },
    "Anthropic": { src: "/images/anthropic_logo.png", alt: "Anthropic" },
    "xAI": { src: "/images/xai_logo.svg", alt: "xAI" },
  };
  
  return logoMap[provider] || { src: "/images/openai_logo.webp", alt: "Unknown Provider" };
};

// Get all available providers
export const getAvailableProviders = () => {
  return ["OpenAI", "Google", "Anthropic", "xAI"];
};

// Check if a provider is supported
export const isProviderSupported = (provider: string) => {
  return getAvailableProviders().includes(provider);
};
