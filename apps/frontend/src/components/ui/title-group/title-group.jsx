import clsx from 'clsx';
import {Title} from '../typography/title/title';
import {Text} from '../typography/text/text';
import s from "./title-group.module.css";

export function TitleGroup(
		{
				subtitle,
				subtitleVariant = "subtitle",
				title,
				titleVariant = "black",
				titleLevel = 1,
				text,
				textVariant = "base",
				align = "left",
				className,
		}
) {
		return (
				<div className={clsx(s.group, s[align], className)}>
						{subtitle && (
								<Text as="span" variant={subtitleVariant}>{subtitle}</Text>
						)}

						<Title level={titleLevel} variant={titleVariant}>
								{title}
						</Title>

						{text && <Text as="p" variant={textVariant}>{text}</Text>}
				</div>
		)
}