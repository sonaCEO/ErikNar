export function DotGrid({
		className,
		cols = 5,
		rows = 5,
		size = 4,
		gap = 10,
}) {
		const step = size + gap;
		const width = cols * size + (cols - 1) * gap;
		const height = rows * size + (rows - 1) * gap;
		const cells = [];

		const radius = size / 2;

		for (let row = 0; row < rows; row += 1) {
				for (let col = 0; col < cols; col += 1) {
						cells.push(
								<circle
									key={`${row}-${col}`}
									cx={col * step + radius}
									cy={row * step + radius}
									r={radius}
									fill="currentColor"
								/>
						);
				}
		}

		return (
				<svg
					className={className}
					viewBox={`0 0 ${width} ${height}`}
					width={width}
					height={height}
					aria-hidden="true"
					focusable="false"
				>
						{cells}
				</svg>
		);
}
