# StyleAI Advisor

This is a Next.js application built in Firebase Studio that acts as a personal style assistant. It analyzes your outfit through an uploaded image and provides personalized style feedback and recommendations based on the occasion, your gender, and real-time weather data.

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

## Machine Learning / AI Approach

Instead of traditional machine learning models, this application employs a sophisticated two-step process powered by the Google Gemini generative AI model:

1.  **Color Extraction:** When a user uploads an image of their outfit, the application first makes a call to the Gemini model. In this step, the AI's task is to analyze the image and extract two key pieces of information: the user's estimated **skin tone** and the dominant **colors of their clothing**.

2.  **Personalized Recommendation:** The extracted skin tone and clothing colors are then combined with the user's provided context (occasion, gender) and real-time weather data fetched from the OpenWeather API. This rich set of information is sent to the Gemini model in a second, more detailed prompt. The model then generates a comprehensive style analysis and a set of personalized recommendations.

This chained-prompting approach allows the application to provide highly relevant and contextual style advice that is tailored to the user's appearance and current environment.