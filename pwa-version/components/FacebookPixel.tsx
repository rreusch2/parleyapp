'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { FacebookPixel } from '../lib/analytics';

interface FacebookPixelProps {
  pixelId: string;
}

export default function FacebookPixelComponent({ pixelId }: FacebookPixelProps) {
  useEffect(() => {
    // Initialize Facebook Pixel after scripts load
    if (typeof window !== 'undefined' && window.fbq) {
      FacebookPixel.init(pixelId);
    }
  }, [pixelId]);

  return (
    <>
      {/* Facebook Pixel base code */}
      <Script
        id="facebook-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
          `,
        }}
      />
      
      {/* Initialize specific pixel */}
      <Script
        id="facebook-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />

      {/* NoScript fallback */}
      <noscript>
        <img
          height="1"
          width="1" 
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
