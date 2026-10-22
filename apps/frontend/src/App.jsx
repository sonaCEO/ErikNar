import {createBrowserRouter, RouterProvider, Outlet} from "react-router";
import Header from "./components/global/header/header";
import Footer from "./components/global/footer/footer";
import {ModalProvider} from "./components/modals/modal-provider";
import {Home} from "./pages/home/home";
import {NotFound} from "./pages/not-found/not-found";
import {ErrorPage} from "./pages/error/error-page";

function Layout() {
		return (
				<ModalProvider>
						<Header />
						<main>
								<Outlet />
						</main>
						<Footer />
				</ModalProvider>
		);
}

const router = createBrowserRouter([
		{
				element: <Layout />,
				errorElement: <ErrorPage />,
				children: [
						{path: "/", element: <Home />},
						{path: "*", element: <NotFound />},
				],
		},
]);

export default function App() {
		return <RouterProvider router={router} />;
}
