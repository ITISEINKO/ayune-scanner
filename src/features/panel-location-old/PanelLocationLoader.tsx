import styles from "./PanelLocationLoader.module.css";

export function PanelLocationLoader({ message }: { message: string }) {
	return (
		<div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 p-5 text-center text-sm text-muted-foreground">
			<svg aria-hidden="true" className="absolute size-0">
				<filter id="panel-location-loader-goo">
					<feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
					<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
				</filter>
			</svg>
			<div aria-hidden="true" className={styles.loader} />
			<p>{message}</p>
		</div>
	);
}
