# SmartStyle

## Abstract

SmartStyle is a modern, AI-powered web application designed to serve as a personal fashion consultant. By leveraging a hybrid approach of client-side image processing and the multimodal capabilities of Google's Gemini model, the application analyzes a user's outfit from an uploaded image and provides personalized style feedback and concrete, visual recommendations. The system enriches its advice by integrating contextual information such as the specified occasion, gender, and real-time weather data fetched from the OpenWeather API.

The user experience begins with uploading an image of their outfit. The application first performs an initial analysis directly in the browser, using a canvas-based algorithm to efficiently extract dominant clothing colors and estimate skin tone. This client-side processing, which uses a traditional image processing heuristic rather than a machine learning model, ensures a fast and responsive user experience. This data, along with user-provided context, is then sent to a backend powered by Next.js Server Actions and Google's Genkit. A Genkit flow prompts the Gemini model to synthesize this information, generating tailored fashion advice. As a final step, the application uses the AI's textual recommendation to generate a photorealistic image of the suggested outfit, providing the user with both written guidance and a visual inspiration.

The frontend is built with Next.js, React, and TypeScript, featuring a vibrant, interactive user interface styled with Tailwind CSS and ShadCN UI components. This innovative combination of client-side algorithms and advanced generative AI delivers a dynamic, cost-effective, and highly personalized user experience, making expert style guidance accessible to everyone.

## Tech Stack

This project is a full-stack application that utilizes a modern web development stack:

- **Frontend:**
  - **Next.js:** A React framework for building server-rendered and statically generated web applications.
  - **React:** A JavaScript library for building user interfaces.
  - **TypeScript:** A statically typed superset of JavaScript that adds type safety.
  - **Tailwind CSS:** A utility-first CSS framework for rapid UI development.
  - **ShadCN UI:** A collection of re-usable UI components.

- **Backend:**
  - **Next.js App Router & Server Actions:** Used for handling server-side logic and API-like functionality without needing to create separate API routes.
  - **Genkit:** An open-source framework from Google for building production-ready AI-powered applications.

- **Generative AI:**
  - **Google Gemini 2.0 Flash:** A powerful, multimodal generative AI model used for both image analysis and text generation.

- **APIs:**
  - **OpenWeather API:** Provides real-time weather data based on the user's location to enhance recommendation accuracy.
