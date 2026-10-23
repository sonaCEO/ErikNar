import {useEffect, useState} from "react";

const MOBILE_MQ = "(max-width: 1199px)";
const ACTIVE_OFFSET = 8;
const HIDE_OFFSET = 64;

export function useHeaderScroll({paused = false} = {}) {
		const [active, setActive] = useState(false);
		const [hidden, setHidden] = useState(false);

		useEffect(() => {
				if (paused) return;

				let lastY = window.scrollY;

				function onScroll() {
						const y = window.scrollY;
						const isMobile = window.matchMedia(MOBILE_MQ).matches;
						const nextActive = y > ACTIVE_OFFSET;
						let nextHidden = false;

						if (isMobile) nextHidden = y > lastY && y > HIDE_OFFSET;

						setActive((prev) => (prev === nextActive ? prev : nextActive));
						setHidden((prev) => (prev === nextHidden ? prev : nextHidden));

						lastY = y;
				}

				onScroll();
				window.addEventListener("scroll", onScroll, {passive: true});

				return () => {
						window.removeEventListener("scroll", onScroll);
				};
		}, [paused]);

		return {active, hidden};
}
