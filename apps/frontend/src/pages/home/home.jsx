import {Hero} from "../../components/sections/hero/hero";
import {Collection} from "../../components/sections/collection/collection";
import {Custom} from "../../components/sections/custom/custom";
import {Spaces} from "../../components/sections/spaces/spaces";
import {Testimonials} from "../../components/sections/testimonials/testimonials";
import {Cta} from "../../components/sections/cta/cta";

export function Home() {
		return (
				<>
						<Hero />
						<Collection />
						<Custom />
						<Spaces />
						<Testimonials />
						<Cta />
				</>
		);
}
