import {useState} from "react";
import {ImageOff} from "lucide-react";
import clsx from "clsx";
import {Skeleton} from "../skeleton/skeleton";
import s from "./image.module.css";

export function Image({src, alt = "", className, loading = "lazy", fit = "cover", ...props}) {
		const [loadedSrc, setLoadedSrc] = useState(null);
		const [failedSrc, setFailedSrc] = useState(null);
		const failed = !src || failedSrc === src;
		const pending = !failed && loadedSrc !== src;

		return (
				<span className={clsx(s.root, className)} aria-busy={pending || undefined}>
      {pending && <Skeleton className={s.skeleton}/>}
						{failed ? (
								<span className={s.placeholder} role="img" aria-label={alt || "Фото отсутствует"}>
          <ImageOff size={28} aria-hidden="true"/>
        </span>
						) : (
								<img
										{...props}
										src={src}
										alt={alt}
										className={clsx(s.image, fit === "contain" && s.contain, pending && s.pending)}
										loading={loading}
										decoding="async"
										onLoad={() => setLoadedSrc(src)}
										onError={() => setFailedSrc(src)}
								/>
						)}
    </span>
		);
}