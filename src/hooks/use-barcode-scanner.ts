"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

const beep = () => {
	const AudioContextClass =
		window.AudioContext ||
		(window as Window & { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AudioContextClass) return;
	const context = new AudioContextClass();
	const oscillator = context.createOscillator();
	oscillator.frequency.value = 880;
	oscillator.connect(context.destination);
	oscillator.start();
	oscillator.stop(context.currentTime + 0.08);
	oscillator.addEventListener("ended", () => context.close());
};

export function useBarcodeScanner(
	elementId: string,
	onDetected: (value: string) => void,
) {
	const scanner = useRef<Html5Qrcode | null>(null);
	const locked = useRef(false);
	const onDetectedRef = useRef(onDetected);
	const [isScanning, setIsScanning] = useState(false);
	const [torchOn, setTorchOn] = useState(false);
	const [error, setError] = useState<string | null>(null);
	onDetectedRef.current = onDetected;

	const stop = useCallback(async () => {
		const instance = scanner.current;
		scanner.current = null;
		setIsScanning(false);
		setTorchOn(false);
		if (!instance) return;
		try {
			if (instance.isScanning) await instance.stop();
		} catch {
			// The stream may already be closed by the device.
		}
		try {
			await instance.clear();
		} catch {
			// The scanner may already have removed its video element.
		}
	}, []);

	const start = useCallback(async () => {
		if (scanner.current || !navigator.mediaDevices?.getUserMedia) {
			if (!navigator.mediaDevices?.getUserMedia)
				setError("Camera is not available in this browser.");
			return;
		}
		setError(null);
		const { Html5Qrcode } = await import("html5-qrcode");
		const instance = new Html5Qrcode(elementId, { verbose: false });
		scanner.current = instance;
		try {
			await instance.start(
				{ facingMode: "environment" },
				{ fps: 10, qrbox: { width: 260, height: 160 } },
				(decodedText) => {
					if (locked.current) return;
					locked.current = true;
					beep();
					navigator.vibrate?.(100);
					void stop()
						.then(() => onDetectedRef.current(decodedText))
						.finally(() => {
							locked.current = false;
						});
				},
				() => undefined,
			);

			const capabilities = instance.getRunningTrackCapabilities() as Record<
				string,
				unknown
			>;
			if (
				Array.isArray(capabilities.focusMode) &&
				capabilities.focusMode.includes("continuous")
			) {
				try {
					await instance.applyVideoConstraints({
						advanced: [{ focusMode: "continuous" }],
					} as unknown as MediaTrackConstraints);
				} catch {
					// The camera can advertise autofocus without allowing control.
				}
			}
			setIsScanning(true);
		} catch {
			scanner.current = null;
			setError(
				"Camera could not be opened. Allow camera access and try again.",
			);
		}
	}, [elementId, stop]);

	const toggleTorch = useCallback(async () => {
		if (!scanner.current) return;
		try {
			await scanner.current.applyVideoConstraints({
				advanced: [{ torch: !torchOn }],
			} as unknown as MediaTrackConstraints);
			setTorchOn((value) => !value);
		} catch {
			setError("This camera does not support its torch.");
		}
	}, [torchOn]);

	const refocus = useCallback(async () => {
		const instance = scanner.current;
		if (!instance?.isScanning) return;
		const focusModes = (instance.getRunningTrackCapabilities() as Record<
			string,
			unknown
		>).focusMode;
		const mode = Array.isArray(focusModes)
			? focusModes.includes("single-shot")
				? "single-shot"
				: focusModes.includes("continuous")
					? "continuous"
					: null
			: null;
		if (!mode) return;
		try {
			await instance.applyVideoConstraints({
				advanced: [{ focusMode: mode }],
			} as unknown as MediaTrackConstraints);
		} catch {
			// The camera can advertise autofocus without allowing control.
		}
	}, []);

	useEffect(
		() => () => {
			void stop();
		},
		[stop],
	);
	return { start, stop, toggleTorch, refocus, isScanning, torchOn, error };
}
