import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google'; 
import { anthropic } from '@ai-sdk/anthropic';
import { xai } from '@ai-sdk/xai';

export const models = [
  {
    name: "GPT-5",
    id: "gpt-5",
    model: openai('gpt-5'),
    provider: "OpenAI",
    enabled: true,
  },
  {
    name: "GPT-5 Mini",
    id: "gpt-5-mini",
    model: openai('gpt-5-mini'),
    provider: "OpenAI",
    enabled: true,
  },
  {
    name: "GPT-5 Nano",
    id: "gpt-5-nano",
    model: openai('gpt-5-nano'),
    provider: "OpenAI",
    enabled: true,
  },
  {
    name: "GPT-4o",
    id: "gpt-4o",
    model: openai('gpt-4o'),
    provider: "OpenAI",
    enabled: true,
  },
  {
    name: "Gemini 2.5 Pro",
    id: "gemini-2.5-pro",
    model: google('gemini-2.5-pro'),
    provider: "Google",
    enabled: true,
  },
  {
    name: "Gemini 2.5 Flash",
    id: "gemini-2.5-flash",
    model: google('gemini-2.5-flash'),
    provider: "Google",
    enabled: true,
  },
  {
    name: "Gemini 2.5 Flash-Lite",
    id: "gemini-2.5-flash-lite",
    model: google('gemini-2.5-flash-lite'),
    provider: "Google",
    enabled: true,
  },
  {
    name: "Claude 4 Sonnet",
    id: "claude-sonnet-4-20250514",
    model: anthropic('claude-sonnet-4-20250514'),
    provider: "Anthropic",
    enabled: true,
  },
  {
    name: "Claude 4 Opus",
    id: "claude-opus-4-20250514",
    model: anthropic('claude-opus-4-20250514'),
    provider: "Anthropic",
    enabled: false,
  },
  {
    name: "Grok 4",
    id: "grok-4",
    model: xai('grok-4'),
    provider: "xAI",
    enabled: true,
  },
  {
    name: "Grok 4 Fast Reasoning",
    id: "grok-4-fast-reasoning",
    model: xai('grok-4-fast-reasoning'),
    provider: "xAI",
    enabled: true,
  },
  {
    name: "Grok 3",
    id: "grok-3",
    model: xai('grok-3'),
    provider: "xAI",
    enabled: true,
  },
];
