"use client";

import {useI18n} from "../i18n";

export function LocalizedText({zh,en}:{zh:React.ReactNode;en:React.ReactNode}){
  const{isEnglish}=useI18n();
  return <>{isEnglish?en:zh}</>;
}
