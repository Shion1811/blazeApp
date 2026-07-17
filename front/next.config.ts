import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// ホームディレクトリ直下に無関係なpackage-lock.jsonがあり、Turbopackがそれを
	// ワークスペースルートと誤認識してビルドが不安定になるため明示的に固定する。
	turbopack: {
		root: path.join(__dirname),
	},
};

export default nextConfig;
