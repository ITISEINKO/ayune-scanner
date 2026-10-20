import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LogInIcon } from "lucide-react";

export function LoginForm({
	className,
	error,
	...props
}: React.ComponentProps<"div"> & { error?: string }) {
	return (
		<div className={cn("flex flex-col", className)} {...props}>
			<Card className="rounded-none bg-transparent py-0 shadow-none ring-0">
				<CardHeader className="px-0 pt-5 pb-0">
					<CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
					<CardDescription className="text-base">
						Continue with your account
					</CardDescription>
				</CardHeader>
				<CardContent className="px-0 pt-6">
					{error === "unauthorized" && (
						<p
							role="alert"
							className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
						>
							Akun ClickUp ini tidak memiliki akses ke Produksi.
						</p>
					)}
					<Button
						nativeButton={false}
						render={<a href="/api/auth/clickup" />}
						className="h-12 w-full rounded-xl shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
					>
						<LogInIcon stroke-width="2.5" className="mr-2" />
						Login Now
					</Button>
					<p className="mt-5 text-center text-xs text-muted-foreground">
						Use your account to access the Panel Production.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
