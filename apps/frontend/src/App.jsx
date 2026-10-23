import {lazy} from "react";
import {createBrowserRouter, RouterProvider, Outlet} from "react-router";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {HelmetProvider} from "react-helmet-async";
import {Toaster} from "sonner";
import Header from "./components/global/header/header";
import Footer from "./components/global/footer/footer";
import {ModalProvider} from "./components/modals/modal-provider";
import {Seo} from "./components/seo/seo";
import {AuthProvider} from "./auth/auth-provider";
import {RequireAuth} from "./auth/require-auth";
import {Home} from "./pages/home/home";
import {NotFound} from "./pages/not-found/not-found";
import {ErrorPage} from "./pages/error/error-page";
import {AdminLogin} from "./pages/admin/login/login";
import {AdminLayout} from "./pages/admin/layout/admin-layout";
import {LeadsPage} from "./pages/admin/leads/leads-page";
import {LeadDetailPage} from "./pages/admin/lead-detail/lead-detail-page";

document.head.querySelectorAll("[data-seo-static]").forEach((tag) => tag.remove());

const ProductsPage = lazy(() => import("./pages/admin/products/products-page").then((module) => ({default: module.ProductsPage})));
const ProductEditorPage = lazy(() => import("./pages/admin/products/product-editor-page").then((module) => ({default: module.ProductEditorPage})));
const UsersPage = lazy(() => import("./pages/admin/users/users-page").then((module) => ({default: module.UsersPage})));

const queryClient = new QueryClient({
		defaultOptions: {
				queries: {
						staleTime: 30 * 1000,
						refetchOnWindowFocus: false,
						retry: (failureCount, error) => {
								if (error?.status >= 400 && error?.status < 500) return false;
								return failureCount < 2;
						},
				},
		},
});

function Layout() {
		return (
				<ModalProvider>
						<Header/>
						<main>
								<Outlet/>
						</main>
						<Footer/>
				</ModalProvider>
		);
}

const router = createBrowserRouter([
		{
				element: <Layout/>,
				errorElement: <ErrorPage/>,
				children: [
						{path: "/", element: <Home/>},
						{path: "*", element: <NotFound/>},
				],
		},
		{
				path: "/admin/login",
				element: <><Seo page="login"/><AdminLogin/></>,
				errorElement: <ErrorPage/>,
		},
		{
				element: <><Seo page="admin"/><RequireAuth/></>,
				errorElement: <ErrorPage/>,
				children: [
						{
								path: "/admin",
								element: <AdminLayout/>,
								children: [
										{index: true, element: <LeadsPage/>},
										{path: "leads/:leadId", element: <LeadDetailPage/>},
										{
												element: <RequireAuth adminOnly/>,
												children: [
														{path: "products", element: <ProductsPage/>},
														{path: "products/new", element: <ProductEditorPage/>},
														{path: "products/:productId", element: <ProductEditorPage/>},
														{path: "users", element: <UsersPage/>},
												],
										},
								],
						},
				],
		},
]);

export default function App() {
		return (
				<HelmetProvider>
						<QueryClientProvider client={queryClient}>
								<AuthProvider>
										<RouterProvider router={router}/>
										<Toaster richColors position="top-right"/>
								</AuthProvider>
						</QueryClientProvider>
				</HelmetProvider>
		);
}
