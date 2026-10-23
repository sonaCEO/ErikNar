import {Helmet} from "react-helmet-async";
import {getPageMetadata} from "./metadata";

export function Seo({page}) {
		const origin = import.meta.env.VITE_SITE_URL
				|| (typeof window === "undefined" ? undefined : window.location.origin);
		return <Helmet {...getPageMetadata(page, origin)} />;
}