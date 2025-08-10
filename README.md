# SmartStyle

## Abstract

SmartStyle is a modern, AI-powered web application designed to serve as a personal fashion consultant. By leveraging the multimodal capabilities of Google's Gemini 2.0 Flash model, the application analyzes a user's outfit from an uploaded image and provides personalized style feedback and concrete recommendations. The system enriches its advice by integrating contextual information such as the specified occasion, gender, and real-time weather data fetched from the OpenWeather API. 

The frontend is built with Next.js, React, and TypeScript, featuring a vibrant, interactive user interface styled with Tailwind CSS and ShadCN UI components. The backend utilizes Next.js Server Actions and Google's Genkit framework to orchestrate the AI-driven logic, which employs a two-step prompting process: first, to extract skin tone and clothing colors from the image, and second, to synthesize this data with user-provided context to generate tailored and actionable fashion advice. This innovative approach delivers a dynamic and highly personalized user experience, making expert style guidance accessible to everyone.

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
