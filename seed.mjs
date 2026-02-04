import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const shops = [
  {
    name: 'Accu Service Holland',
    slug: 'ash',
    domain: 'accuserviceholland.nl',
    api_key: 'e6563f50275583106e31f147eef8ed93',
    api_secret: 'b7280e76e69eb2258b3a768f7afc360f'
  },
  {
    name: 'Hoorbatterij Online', 
    slug: 'hoor',
    domain: 'hoorbatterijonline.nl',
    api_key: '24d482b13cff5a6592839fb7fb32c56f',
    api_secret: '2090785b6c9cfb46b2492c8f54c556ce'
  },
  {
    name: 'Rubberboot Expert',
    slug: 'rubb', 
    domain: 'rubberbootexpert.nl',
    api_key: '2fab9e55ef4705020ac9882b3869e4fb',
    api_secret: '63f54cefb33922bfb035f98b3d4c88f9'
  },
  {
    name: 'Motoraccu.nl',
    slug: 'moto',
    domain: 'motoraccu.nl', 
    api_key: '1a33cc296fa30d20b62cc40acfe485b4',
    api_secret: '0546a9a4ad6d63e76a1b20b124d73b15'
  }
];

for (const shop of shops) {
  await sql`
    INSERT INTO shops (name, slug, domain, lightspeed_api_key, lightspeed_api_secret)
    VALUES (${shop.name}, ${shop.slug}, ${shop.domain}, ${shop.api_key}, ${shop.api_secret})
    ON CONFLICT (slug) DO NOTHING
  `;
  console.log('Added:', shop.name);
}

console.log('Done!');
