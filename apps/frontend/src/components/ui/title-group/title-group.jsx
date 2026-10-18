import clsx from 'clsx';
import {Title} from '../typography/title/title.jsx';
import {Text} from '../typography/text/text.jsx';
import s from "./title-group.module.css";

export function TitleGroup(
		{
				subtitle, title, titleVariant = "black", titleLevel = 1, text, textVariant = "base", align = "left"
		}
) {
		return (
				<div className={clsx(s.group, s[align])}>
						<Text as="span" variant="subtitle">{subtitle}</Text>

						<Title level={titleLevel} variant={titleVariant}>
								{title}
						</Title>

						{text && <Text as="p" variant={textVariant}>{text}</Text>}
				</div>
		)
}