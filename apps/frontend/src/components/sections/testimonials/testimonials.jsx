import {ArrowLeft, ArrowRight, Star} from "lucide-react";
import {useRef, useState} from "react";
import {Swiper, SwiperSlide} from "swiper/react";
import "swiper/css";
import LayoutContainer from "../../grid/layout-container/layout-container";
import {Button} from "../../ui/button/button";
import {TitleGroup} from "../../ui/title-group/title-group";
import {Text} from "../../ui/typography/text/text";
import {testimonials, testimonialsMeta} from "./data";
import s from "./testimonials.module.css";

function Stars() {
		return (
				<span className={s.stars} role="img" aria-label="5 из 5">
						{[...Array(5).keys()].map((index) => (
								<Star key={index} size={18} aria-hidden fill="currentColor"/>
						))}
				</span>
		);
}

function SliderControls({className, swiperRef, isBeginning, isEnd}) {
		return (
				<div className={className} role="group" aria-label="Управление отзывами">
						<Button
								variant="soft"
								size="mini"
								className={s.control}
								aria-label="Предыдущие отзывы"
								disabled={isBeginning}
								onClick={() => swiperRef.current?.slidePrev()}
						>
								<ArrowLeft className={s.arrow} size={20} strokeWidth={2.5} aria-hidden="true"/>
						</Button>
						<Button
								variant="soft"
								size="mini"
								className={s.control}
								aria-label="Следующие отзывы"
								disabled={isEnd}
								onClick={() => swiperRef.current?.slideNext()}
						>
								<ArrowRight className={s.arrow} size={20} strokeWidth={2.5} aria-hidden="true"/>
						</Button>
				</div>
		);
}

export function Testimonials() {
		const swiperRef = useRef(null);
		const [isBeginning, setIsBeginning] = useState(true);
		const [isEnd, setIsEnd] = useState(false);

		function updateControls(swiper) {
				setIsBeginning(swiper.isBeginning);
				setIsEnd(swiper.isEnd);
		}

		const slides = testimonials.map((item) => (
				<SwiperSlide key={item.id} className={s.slide}>
						<article className={s.card}>
								<Text as="span" variant="label">
										{item.name}
								</Text>
								<Text as="p" variant="base" className={s.quote}>
										{item.text}
								</Text>
								<Text as="p" variant="muted">
										{item.meta}
								</Text>
						</article>
				</SwiperSlide>
		));

		return (
				<section className={s.testimonials} id="reviews">
						<LayoutContainer>
								<div className={s.inner}>
										<div className={s.header}>
												<div className={s.heading}>
														<TitleGroup
																subtitle={testimonialsMeta.subtitle}
																title="Отзывы клиентов"
																titleLevel={2}
														/>
												</div>
												<SliderControls
														className={s.controls}
														swiperRef={swiperRef}
														isBeginning={isBeginning}
														isEnd={isEnd}
												/>
										</div>

										<div className={s.content}>
												<div className={s.summary}>
														<div className={s.rating}>
																<Text as="span" variant="strong">
																		{testimonialsMeta.rating}
																</Text>
																<Stars/>
														</div>

														<Text as="p" variant="muted">
																{testimonialsMeta.count}
														</Text>
												</div>

												<div className={s.slider}>
														<Swiper
																className={s.swiper}
																onSwiper={(swiper) => {
																		swiperRef.current = swiper;
																		updateControls(swiper);
																}}
																onSlideChange={updateControls}
																grabCursor
																slidesPerView={1.15}
																spaceBetween={16}
																slidesOffsetAfter={20}
																breakpoints={{
																		768: {slidesPerView: 2, spaceBetween: 16},
																		992: {slidesPerView: 2.15, spaceBetween: 20},
																		1200: {slidesPerView: 2.25, spaceBetween: 20},
																}}
														>
																<>{slides}</>
														</Swiper>
												</div>
										</div>
								</div>
						</LayoutContainer>
				</section>
		);
}
