import path from "path";
import { AppConfig } from "../config";
import { imageToBase64 } from "../utils/image";

export function getLeftLogo(config: AppConfig, defaultAssetName: string): string {
  return config.leftLogo ?? imageToBase64(path.resolve(__dirname, "../assets", defaultAssetName));
}

export function getRightLogo(config: AppConfig, defaultAssetName: string): string {
  return config.rightLogo ?? imageToBase64(path.resolve(__dirname, "../assets", defaultAssetName));
}
