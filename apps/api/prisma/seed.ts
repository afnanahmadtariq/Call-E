import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Clear existing data
    await prisma.callLog.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.provider.deleteMany();

    // Seed demo providers
    const providers = await prisma.provider.createMany({
        data: [
            {
                name: 'Smile Dental Clinic',
                phone: '+15551234567',
                serviceType: 'dentist',
                location: 'New York, NY',
                rating: 4.8,
            },
            {
                name: 'City Hair Salon',
                phone: '+15559876543',
                serviceType: 'salon',
                location: 'New York, NY',
                rating: 4.5,
            },
            {
                name: 'QuickFix Plumbing',
                phone: '+15555551234',
                serviceType: 'plumber',
                location: 'New York, NY',
                rating: 4.7,
            },
            {
                name: 'Bright Eyes Optometry',
                phone: '+15558887777',
                serviceType: 'optometrist',
                location: 'New York, NY',
                rating: 4.9,
            },
            {
                name: 'Elite Auto Repair',
                phone: '+15552223333',
                serviceType: 'mechanic',
                location: 'New York, NY',
                rating: 4.6,
            },
        ],
    });

    console.log(`✅ Created ${providers.count} demo providers`);
    console.log('🌱 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
