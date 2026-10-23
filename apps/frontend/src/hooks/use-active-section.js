import {useEffect, useState} from "react";

const DESKTOP_MQ = "(min-width: 1200px)";
const HEADER_OFFSET = 96;

export function useActiveSection(sectionIds = []) {
		const [activeId, setActiveId] = useState(null);

		useEffect(() => {
				if (sectionIds.length === 0) return undefined;

				function resolveActive() {
						const isDesktop = window.matchMedia(DESKTOP_MQ).matches;
						if (!isDesktop) {
								setActiveId((prev) => (prev === null ? prev : null));
								return;
						}

						const scrollBottom = window.scrollY + window.innerHeight;
						const docHeight = document.documentElement.scrollHeight;

						if (scrollBottom >= docHeight - 4) {
								const lastId = sectionIds[sectionIds.length - 1];
								setActiveId((prev) => (prev === lastId ? prev : lastId));
								return;
						}

						let current = null;

						for (const id of sectionIds) {
								const element = document.getElementById(id);
								if (!element) continue;

								if (element.getBoundingClientRect().top <= HEADER_OFFSET) {
										current = id;
								}
						}

						setActiveId((prev) => (prev === current ? prev : current));
				}

				resolveActive();
				window.addEventListener("scroll", resolveActive, {passive: true});
				window.addEventListener("resize", resolveActive);

				return () => {
						window.removeEventListener("scroll", resolveActive);
						window.removeEventListener("resize", resolveActive);
				};
		}, [sectionIds]);

		return activeId;
}
