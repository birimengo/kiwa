import { useEffect } from 'react';

const SEO = ({ 
  title, 
  description, 
  keywords, 
  image, 
  url, 
  type = 'website',
  noIndex = false,
  productData = null,
  pageType = 'website'
}) => {
  const siteTitle = "Kiwa General Electricals - Uganda's Electrical Superstore | ☎️ 0751808507";
  const siteDescription = "Uganda's No.1 Electrical & Electronics Store. Wholesale & Retail prices for Home Appliances, Industrial Equipment, Wires, Switches, Sockets, Generators, Solar Systems. Call 0751808507 or email gogreenuganda70@gmail.com";
  const siteUrl = "https://kiwa-general-electricals.vercel.app";
  const defaultImage = `${siteUrl}/og-image.jpg`;

  useEffect(() => {
    // Update title
    const finalTitle = title ? `${title} | Kiwa Electricals Uganda` : siteTitle;
    document.title = finalTitle;
    
    // Update meta tags
    updateMetaTag('description', description || siteDescription);
    updateMetaTag('keywords', keywords || "electrical Uganda, electronics Kampala, wholesale electricals, 0751808507, gogreenuganda70@gmail.com, home appliances Uganda, industrial equipment, wires cables, switches sockets, generators, solar systems Uganda");
    
    // Update Open Graph tags
    updateMetaTag('og:title', finalTitle, true);
    updateMetaTag('og:description', description || siteDescription, true);
    updateMetaTag('og:image', image || defaultImage, true);
    updateMetaTag('og:url', url || window.location.href, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:locale', 'en_UG', true);
    updateMetaTag('og:site_name', 'Kiwa General Electricals Uganda', true);
    
    // Update Twitter tags
    updateMetaTag('twitter:card', 'summary_large_image', true);
    updateMetaTag('twitter:title', finalTitle, true);
    updateMetaTag('twitter:description', description || siteDescription, true);
    updateMetaTag('twitter:image', image || defaultImage, true);
    updateMetaTag('twitter:site', '@kiwaelectricals', true);
    
    // Update canonical
    updateLinkTag('canonical', url || window.location.href);
    
    // No-index if needed
    if (noIndex) {
      updateMetaTag('robots', 'noindex, nofollow');
    } else {
      updateMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    }

    // Add structured data based on page type
    addStructuredData(pageType, productData, finalTitle, description || siteDescription, url || window.location.href);

    // Update viewport for better mobile experience
    updateViewportMeta();

    return () => {
      // Cleanup dynamic structured data
      const dynamicSchemas = document.querySelectorAll('script[data-dynamic-schema="true"]');
      dynamicSchemas.forEach(schema => schema.remove());
    };
  }, [title, description, keywords, image, url, type, noIndex, productData, pageType]);

  const updateMetaTag = (name, content, isProperty = false) => {
    let element = document.querySelector(
      isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`
    );
    
    if (!element) {
      element = document.createElement('meta');
      if (isProperty) {
        element.setAttribute('property', name);
      } else {
        element.setAttribute('name', name);
      }
      document.head.appendChild(element);
    }
    
    element.setAttribute('content', content);
  };

  const updateLinkTag = (rel, href) => {
    let element = document.querySelector(`link[rel="${rel}"]`);
    
    if (!element) {
      element = document.createElement('link');
      element.setAttribute('rel', rel);
      document.head.appendChild(element);
    }
    
    element.setAttribute('href', href);
  };

  const updateViewportMeta = () => {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
  };

  const addStructuredData = (type, productData, pageTitle, pageDescription, pageUrl) => {
    // Remove existing dynamic schemas
    const existingSchemas = document.querySelectorAll('script[data-dynamic-schema="true"]');
    existingSchemas.forEach(schema => schema.remove());

    let schema = {};

    switch (type) {
      case 'product':
        if (productData) {
          schema = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": productData.name || pageTitle,
            "description": productData.description || pageDescription,
            "image": productData.image || defaultImage,
            "sku": productData.sku || "",
            "mpn": productData.mpn || "",
            "brand": {
              "@type": "Brand",
              "name": productData.brand || "Kiwa Electricals"
            },
            "offers": {
              "@type": "Offer",
              "url": pageUrl,
              "priceCurrency": "UGX",
              "price": productData.price || "",
              "priceValidUntil": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
              "availability": productData.availability || "https://schema.org/InStock",
              "seller": {
                "@type": "Organization",
                "name": "Kiwa General Electricals",
                "telephone": "+256751808507",
                "email": "gogreenuganda70@gmail.com"
              },
              "areaServed": "UG"
            },
            "aggregateRating": productData.rating ? {
              "@type": "AggregateRating",
              "ratingValue": productData.rating.value,
              "ratingCount": productData.rating.count,
              "bestRating": "5",
              "worstRating": "1"
            } : undefined
          };
        }
        break;

      case 'collection':
        schema = {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": pageTitle,
          "description": pageDescription,
          "url": pageUrl,
          "mainEntity": {
            "@type": "ItemList",
            "itemListElement": productData?.map((product, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "item": {
                "@type": "Product",
                "name": product.name,
                "url": `${siteUrl}/products/${product.id}`,
                "image": product.image
              }
            })) || []
          }
        };
        break;

      default:
        // Website schema
        schema = {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": pageTitle,
          "description": pageDescription,
          "url": pageUrl,
          "publisher": {
            "@type": "Organization",
            "name": "Kiwa General Electricals",
            "logo": {
              "@type": "ImageObject",
              "url": `${siteUrl}/trade-svgrepo-com.svg`
            },
            "contactPoint": {
              "@type": "ContactPoint",
              "telephone": "+256751808507",
              "contactType": "customer service",
              "areaServed": "UG",
              "availableLanguage": ["en", "lg"]
            }
          }
        };
        break;
    }

    // Add breadcrumb schema
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": siteUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": pageTitle.includes('Products') ? 'Products' : 'Page',
          "item": pageUrl
        }
      ]
    };

    // Add the schemas to the page
    [schema, breadcrumbSchema].forEach((data, index) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-dynamic-schema', 'true');
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });
  };

  // Component doesn't render anything visible
  return null;
};

export default SEO;