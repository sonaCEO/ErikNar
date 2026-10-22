import {Hero} from "../../components/sections/hero/hero";
import {Collection} from "../../components/sections/collection/collection";
import {Advantages} from "../../components/sections/advantages/advantages";
import {Custom} from "../../components/sections/custom/custom";
import {Spaces} from "../../components/sections/spaces/spaces";
import {Testimonials} from "../../components/sections/testimonials/testimonials";
import {Cta} from "../../components/sections/cta/cta";

export function Home() {
		return (
				<>
						<Hero />
						<Collection />
						<Advantages />
						<Custom />
						<Spaces />
						<Testimonials />
						<Cta />
				</>
		);
}
