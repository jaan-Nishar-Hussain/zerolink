import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { PaymentLink } from './pages/PaymentLink.tsx'
import { Withdrawal } from './pages/Withdrawal.tsx'

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/dashboard",
    element: <><App activePage="dashboard" /></>, // We'll update App to handle components or just use children
  },
  {
    path: "/link/:slug",
    element: <PaymentLink />,
  },
  {
    path: "/withdraw",
    element: <Withdrawal />,
  }
]);

// Actually, I'll update App to be the Layout and handle routing inside it for a cleaner feel
// Let's refactor App to use <Outlet /> and use sub-routes

const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "withdraw",
        element: <Withdrawal />,
      },
      // PaymentLink is a special full-page view without the main nav usually, or with it?
      // PRD says its a payment page. I'll keep it outside App for now if it needs a different feel
    ]
  },
  {
    path: "/link/:slug",
    element: <PaymentLink />,
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={appRouter} />
  </StrictMode>,
)
