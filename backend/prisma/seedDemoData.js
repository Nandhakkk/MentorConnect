const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  console.log('--- MentorConnect Database Cleanup & Demo Seeding ---');
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash('password', saltRounds);

  // 1. Identify and delete disposable test users
  const disposableUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: '@test.com' } },
        { email: { endsWith: '@student.edu' } },
        { email: { in: ['student2@example.com', 'new.mentor@example.com', 'new.student@example.com'] } }
      ]
    },
    select: { id: true, email: true, name: true, role: true }
  });

  console.log(`Found ${disposableUsers.length} disposable test accounts to remove.`);

  if (disposableUsers.length > 0) {
    const userIds = disposableUsers.map(u => u.id);

    // Delete orphaned file assets for these users if any
    const deletedAssets = await prisma.fileAsset.deleteMany({
      where: { ownerId: { in: userIds } }
    });
    if (deletedAssets.count > 0) {
      console.log(`Cleaned up ${deletedAssets.count} related FileAsset records.`);
    }

    // Delete users (Prisma & DB cascade will delete profiles, applications, sessions, etc.)
    const deleteResult = await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });
    console.log(`Successfully deleted ${deleteResult.count} disposable test users.`);
  }

  // 2. Ensure Topics exist for mentoring
  const topicNames = [
    { name: 'System Design', category: 'Software Engineering' },
    { name: 'Cloud Architecture', category: 'DevOps & Cloud' },
    { name: 'Full-Stack Web Development', category: 'Software Engineering' },
    { name: 'Data Structures & Algorithms', category: 'Computer Science' },
    { name: 'React & Frontend Architecture', category: 'Frontend Development' }
  ];

  const topics = [];
  for (const t of topicNames) {
    const topic = await prisma.topic.upsert({
      where: { name: t.name },
      update: { category: t.category },
      create: { name: t.name, category: t.category }
    });
    topics.push(topic);
  }
  console.log(`Ensured ${topics.length} base mentoring topics.`);

  // 3. Demo Account 1: admin@gmail.com (ADMIN)
  console.log('Seeding demo Admin: admin@gmail.com...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      name: 'System Admin',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      emailVerifiedAt: new Date()
    },
    create: {
      name: 'System Admin',
      email: 'admin@gmail.com',
      password: hashedPassword,
      role: 'ADMIN',
      dateOfBirth: new Date('1990-01-01'),
      phone: '+919876543201',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      emailVerifiedAt: new Date()
    }
  });

  // 4. Demo Account 2: arun@gmail.com (STUDENT)
  console.log('Seeding demo Student: arun@gmail.com...');
  const arunUser = await prisma.user.upsert({
    where: { email: 'arun@gmail.com' },
    update: {
      name: 'Arun Kumar',
      password: hashedPassword,
      role: 'STUDENT',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      dateOfBirth: new Date('2001-05-15')
    },
    create: {
      name: 'Arun Kumar',
      email: 'arun@gmail.com',
      password: hashedPassword,
      role: 'STUDENT',
      dateOfBirth: new Date('2001-05-15'),
      phone: '+919876543202',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      emailVerifiedAt: new Date()
    }
  });

  const arunProfile = await prisma.studentProfile.upsert({
    where: { userId: arunUser.id },
    update: {
      bio: 'Final-year MCA student specializing in web technologies and scalable system engineering.',
      education: 'B.Sc Computer Science, currently pursuing MCA',
      skills: 'JavaScript, React, Node.js, Express, PostgreSQL, Git',
      interests: 'Full-Stack Development, Cloud Systems, Open Source',
      careerGoal: 'Full-Stack Software Engineer',
      preferredLearningStyle: 'Hands-on Projects & Code Reviews',
      preferredLanguage: 'English',
      budget: 1000,
      studyAvailability: 'Evenings and Weekends',
      experienceLevel: 'Intermediate',
      onboardingCompleted: true
    },
    create: {
      userId: arunUser.id,
      bio: 'Final-year MCA student specializing in web technologies and scalable system engineering.',
      education: 'B.Sc Computer Science, currently pursuing MCA',
      skills: 'JavaScript, React, Node.js, Express, PostgreSQL, Git',
      interests: 'Full-Stack Development, Cloud Systems, Open Source',
      careerGoal: 'Full-Stack Software Engineer',
      preferredLearningStyle: 'Hands-on Projects & Code Reviews',
      preferredLanguage: 'English',
      budget: 1000,
      studyAvailability: 'Evenings and Weekends',
      experienceLevel: 'Intermediate',
      onboardingCompleted: true
    }
  });

  // Ensure Arun has goals
  const existingArunGoals = await prisma.goal.count({ where: { studentId: arunProfile.id } });
  if (existingArunGoals === 0) {
    await prisma.goal.create({
      data: {
        studentId: arunProfile.id,
        title: 'Master Full-Stack Web Development with React and Node.js',
        description: 'Deepen knowledge in building production-ready web apps with clean architecture.',
        status: 'ACTIVE',
        targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      }
    });
    await prisma.goal.create({
      data: {
        studentId: arunProfile.id,
        title: 'Prepare for Technical Software Engineering Interviews',
        description: 'Practice system design questions and algorithm problem solving.',
        status: 'ACTIVE',
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    });
  }

  // 5. Demo Account 3: rahul@gmail.com (STUDENT)
  console.log('Seeding demo Student: rahul@gmail.com...');
  const rahulUser = await prisma.user.upsert({
    where: { email: 'rahul@gmail.com' },
    update: {
      name: 'Rahul Sharma',
      password: hashedPassword,
      role: 'STUDENT',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      dateOfBirth: new Date('2002-08-20')
    },
    create: {
      name: 'Rahul Sharma',
      email: 'rahul@gmail.com',
      password: hashedPassword,
      role: 'STUDENT',
      dateOfBirth: new Date('2002-08-20'),
      phone: '+919876543203',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      emailVerifiedAt: new Date()
    }
  });

  const rahulProfile = await prisma.studentProfile.upsert({
    where: { userId: rahulUser.id },
    update: {
      bio: 'Enthusiastic computer science student passionate about algorithms, data structures, and backend systems.',
      education: 'B.Tech in Information Technology',
      skills: 'Python, Java, Data Structures, Algorithms, SQL',
      interests: 'Competitive Programming, Machine Learning, Backend Services',
      careerGoal: 'Software Development Engineer (Backend)',
      preferredLearningStyle: 'Interactive Sessions & Problem Solving',
      preferredLanguage: 'English',
      budget: 800,
      studyAvailability: 'Weekday Evenings',
      experienceLevel: 'Beginner',
      onboardingCompleted: true
    },
    create: {
      userId: rahulUser.id,
      bio: 'Enthusiastic computer science student passionate about algorithms, data structures, and backend systems.',
      education: 'B.Tech in Information Technology',
      skills: 'Python, Java, Data Structures, Algorithms, SQL',
      interests: 'Competitive Programming, Machine Learning, Backend Services',
      careerGoal: 'Software Development Engineer (Backend)',
      preferredLearningStyle: 'Interactive Sessions & Problem Solving',
      preferredLanguage: 'English',
      budget: 800,
      studyAvailability: 'Weekday Evenings',
      experienceLevel: 'Beginner',
      onboardingCompleted: true
    }
  });

  const existingRahulGoals = await prisma.goal.count({ where: { studentId: rahulProfile.id } });
  if (existingRahulGoals === 0) {
    await prisma.goal.create({
      data: {
        studentId: rahulProfile.id,
        title: 'Master Data Structures & Algorithms',
        description: 'Complete 150 LeetCode problems covering trees, graphs, and dynamic programming.',
        status: 'ACTIVE',
        targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
      }
    });
  }

  // 6. Demo Account 4: priya@gmail.com (PROFESSIONAL MENTOR)
  console.log('Seeding demo Professional Mentor: priya@gmail.com...');
  const priyaUser = await prisma.user.upsert({
    where: { email: 'priya@gmail.com' },
    update: {
      name: 'Dr. Priya Sundaram',
      password: hashedPassword,
      role: 'MENTOR',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      dateOfBirth: new Date('1986-03-25')
    },
    create: {
      name: 'Dr. Priya Sundaram',
      email: 'priya@gmail.com',
      password: hashedPassword,
      role: 'MENTOR',
      dateOfBirth: new Date('1986-03-25'),
      phone: '+919876543204',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      emailVerifiedAt: new Date()
    }
  });

  const priyaMentorProfile = await prisma.mentorProfile.upsert({
    where: { userId: priyaUser.id },
    update: {
      mentorType: 'PROFESSIONAL',
      status: 'APPROVED',
      bio: 'Lead Software Architect with 12+ years of experience in distributed systems, microservices, and cloud architecture. Passionate about empowering aspiring developers.',
      expertise: 'System Design, Cloud Architecture, Scalable Backends, React & Node.js',
      experience: 12,
      teachingExperience: 6,
      hourlyRate: 800,
      sessionFee: 800,
      isAvailable: true,
      language: 'English, Tamil',
      linkedinUrl: 'https://linkedin.com/in/priya-sundaram-demo',
      verifiedAt: new Date()
    },
    create: {
      userId: priyaUser.id,
      mentorType: 'PROFESSIONAL',
      status: 'APPROVED',
      bio: 'Lead Software Architect with 12+ years of experience in distributed systems, microservices, and cloud architecture. Passionate about empowering aspiring developers.',
      expertise: 'System Design, Cloud Architecture, Scalable Backends, React & Node.js',
      experience: 12,
      teachingExperience: 6,
      hourlyRate: 800,
      sessionFee: 800,
      isAvailable: true,
      language: 'English, Tamil',
      linkedinUrl: 'https://linkedin.com/in/priya-sundaram-demo',
      verifiedAt: new Date()
    }
  });

  // Connect Topics for Priya
  for (const t of topics.slice(0, 3)) {
    await prisma.mentorTopic.upsert({
      where: {
        mentorId_topicId: {
          mentorId: priyaMentorProfile.id,
          topicId: t.id
        }
      },
      update: {},
      create: {
        mentorId: priyaMentorProfile.id,
        topicId: t.id
      }
    });
  }

  // Ensure Priya has an approved application & AI screening result
  let priyaApp = await prisma.mentorApplication.findFirst({
    where: { mentorId: priyaMentorProfile.id }
  });

  if (!priyaApp) {
    priyaApp = await prisma.mentorApplication.create({
      data: {
        mentorId: priyaMentorProfile.id,
        status: 'APPROVED',
        professionalSummary: 'Senior engineering leader and mentor providing 1-on-1 coaching in architecture and career growth.',
        expertise: 'System Design, Cloud Architecture, Node.js, React',
        experience: 12,
        teachingExperience: 6,
        proposedSessionFee: 800,
        languages: 'English, Tamil',
        linkedinUrl: 'https://linkedin.com/in/priya-sundaram-demo',
        reviewNotes: 'Verified professional background, architecture leadership experience, and positive teaching references.',
        reviewerId: adminUser.id,
        reviewedAt: new Date(),
        aiScreening: {
          create: {
            screeningStatus: 'COMPLETED',
            recommendation: 'APPROVE',
            structuredFindings: {
              summary: 'Applicant satisfies all criteria for professional mentor onboarding.',
              passedCriteria: ['MIN_AGE_18', 'VALID_EXPERIENCE', 'COMPREHENSIVE_PROFILE'],
              failedCriteria: []
            },
            riskFlags: []
          }
        }
      }
    });
  }

  // Add Availability for Priya
  const days = ['Monday', 'Wednesday', 'Friday'];
  for (const day of days) {
    const existingAvail = await prisma.mentorAvailability.findFirst({
      where: { mentorId: priyaMentorProfile.id, dayOfWeek: day }
    });
    if (!existingAvail) {
      await prisma.mentorAvailability.create({
        data: {
          mentorId: priyaMentorProfile.id,
          dayOfWeek: day,
          startTime: '10:00',
          endTime: '18:00',
          isActive: true
        }
      });
    }
  }

  // 7. Demo Account 5: karthik@gmail.com (PEER MENTOR)
  console.log('Seeding demo Peer Mentor: karthik@gmail.com...');
  // Note: Peer mentors in MentorConnect have role = STUDENT, studentProfile, and an approved mentorProfile with mentorType = PEER
  const karthikUser = await prisma.user.upsert({
    where: { email: 'karthik@gmail.com' },
    update: {
      name: 'Karthik Raman',
      password: hashedPassword,
      role: 'STUDENT',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      dateOfBirth: new Date('2000-09-12')
    },
    create: {
      name: 'Karthik Raman',
      email: 'karthik@gmail.com',
      password: hashedPassword,
      role: 'STUDENT',
      dateOfBirth: new Date('2000-09-12'),
      phone: '+919876543205',
      isActive: true,
      isSuspended: false,
      isEmailVerified: true,
      emailVerifiedAt: new Date()
    }
  });

  const karthikStudentProfile = await prisma.studentProfile.upsert({
    where: { userId: karthikUser.id },
    update: {
      bio: 'Top-performing graduate student and peer mentor assisting learners in Data Structures, Algorithms, and Frontend Development.',
      education: 'MCA, 2nd Year',
      skills: 'Data Structures, Algorithms, JavaScript, React, Problem Solving',
      interests: 'Peer Tutoring, Competitive Programming, Web Development',
      careerGoal: 'Software Engineer',
      preferredLearningStyle: 'Peer Discussion & Pair Programming',
      preferredLanguage: 'English',
      experienceLevel: 'Advanced',
      onboardingCompleted: true
    },
    create: {
      userId: karthikUser.id,
      bio: 'Top-performing graduate student and peer mentor assisting learners in Data Structures, Algorithms, and Frontend Development.',
      education: 'MCA, 2nd Year',
      skills: 'Data Structures, Algorithms, JavaScript, React, Problem Solving',
      interests: 'Peer Tutoring, Competitive Programming, Web Development',
      careerGoal: 'Software Engineer',
      preferredLearningStyle: 'Peer Discussion & Pair Programming',
      preferredLanguage: 'English',
      experienceLevel: 'Advanced',
      onboardingCompleted: true
    }
  });

  const karthikMentorProfile = await prisma.mentorProfile.upsert({
    where: { userId: karthikUser.id },
    update: {
      mentorType: 'PEER',
      status: 'APPROVED',
      bio: 'Experienced student peer mentor ready to guide peers in mastering algorithms and foundational web development concepts.',
      expertise: 'Data Structures, Algorithms, React Foundations',
      experience: 2,
      teachingExperience: 2,
      hourlyRate: 0,
      sessionFee: 0,
      isAvailable: true,
      language: 'English, Hindi',
      verifiedAt: new Date()
    },
    create: {
      userId: karthikUser.id,
      mentorType: 'PEER',
      status: 'APPROVED',
      bio: 'Experienced student peer mentor ready to guide peers in mastering algorithms and foundational web development concepts.',
      expertise: 'Data Structures, Algorithms, React Foundations',
      experience: 2,
      teachingExperience: 2,
      hourlyRate: 0,
      sessionFee: 0,
      isAvailable: true,
      language: 'English, Hindi',
      verifiedAt: new Date()
    }
  });

  // Connect Topics for Karthik
  const dsaTopic = topics.find(t => t.name === 'Data Structures & Algorithms');
  if (dsaTopic) {
    await prisma.mentorTopic.upsert({
      where: {
        mentorId_topicId: {
          mentorId: karthikMentorProfile.id,
          topicId: dsaTopic.id
        }
      },
      update: {},
      create: {
        mentorId: karthikMentorProfile.id,
        topicId: dsaTopic.id
      }
    });
  }

  // Ensure Karthik has an approved peer application & AI screening
  let karthikApp = await prisma.peerMentorApplication.findFirst({
    where: { mentorId: karthikMentorProfile.id }
  });

  if (!karthikApp) {
    await prisma.peerMentorApplication.create({
      data: {
        mentorId: karthikMentorProfile.id,
        status: 'APPROVED',
        eligibilityInfo: 'Senior MCA student with high academic standing, completed onboarding, and demonstrated peer tutoring experience.',
        reviewNotes: 'Verified student onboarding, GPA, and peer mentor eligibility requirements.',
        reviewerId: adminUser.id,
        reviewedAt: new Date(),
        aiScreening: {
          create: {
            screeningStatus: 'COMPLETED',
            recommendation: 'APPROVE',
            structuredFindings: {
              summary: 'Applicant fulfills all peer mentor eligibility standards.',
              passedCriteria: ['MIN_AGE_18', 'ONBOARDING_COMPLETED', 'SKILLS_PROVIDED'],
              failedCriteria: []
            },
            riskFlags: []
          }
        }
      }
    });
  }

  // Add Availability for Karthik
  const peerDays = ['Tuesday', 'Thursday', 'Saturday'];
  for (const day of peerDays) {
    const existingAvail = await prisma.mentorAvailability.findFirst({
      where: { mentorId: karthikMentorProfile.id, dayOfWeek: day }
    });
    if (!existingAvail) {
      await prisma.mentorAvailability.create({
        data: {
          mentorId: karthikMentorProfile.id,
          dayOfWeek: day,
          startTime: '14:00',
          endTime: '19:00',
          isActive: true
        }
      });
    }
  }

  // 8. Connect a demo active mentorship between Arun and Priya
  console.log('Connecting demo Mentorship between Arun (Student) and Priya (Professional Mentor)...');
  let mentorship = await prisma.mentorship.findFirst({
    where: {
      studentId: arunProfile.id,
      mentorId: priyaMentorProfile.id
    }
  });

  if (!mentorship) {
    mentorship = await prisma.mentorship.create({
      data: {
        studentId: arunProfile.id,
        mentorId: priyaMentorProfile.id,
        status: 'ACTIVE',
        startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    });

    // Create an upcoming session
    const scheduledDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    scheduledDate.setHours(15, 0, 0, 0);

    const session = await prisma.session.create({
      data: {
        mentorshipId: mentorship.id,
        scheduledAt: scheduledDate,
        duration: 60,
        status: 'SCHEDULED',
        topic: 'Full-Stack Web Architecture & Code Review',
        meetingLink: 'https://meet.google.com/abc-defg-hij'
      }
    });

    // Create demo assignment
    await prisma.assignment.create({
      data: {
        mentorshipId: mentorship.id,
        sessionId: session.id,
        mentorId: priyaMentorProfile.id,
        studentId: arunProfile.id,
        title: 'Build a RESTful API with PostgreSQL & Express',
        description: 'Implement CRUD endpoints with JWT authentication and input validation.',
        instructions: 'Submit the GitHub repository link or code archive before the session.',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'ASSIGNED'
      }
    });

    // Welcome messages in mentorship
    await prisma.message.create({
      data: {
        senderId: priyaUser.id,
        mentorshipId: mentorship.id,
        content: "Hi Arun! Welcome to MentorConnect. Looking forward to our upcoming session on Full-Stack Architecture!"
      }
    });

    await prisma.message.create({
      data: {
        senderId: arunUser.id,
        mentorshipId: mentorship.id,
        content: "Thank you Dr. Priya! I have prepared the database schema and look forward to your feedback."
      }
    });
  }

  console.log('\n--- Seeding and Cleanup Complete! ---');
  console.log('Demo Credentials Summary:');
  console.log('--------------------------------------------------');
  console.log('1. Admin:               admin@gmail.com    | password');
  console.log('2. Student:             arun@gmail.com     | password');
  console.log('3. Student:             rahul@gmail.com    | password');
  console.log('4. Professional Mentor: priya@gmail.com    | password');
  console.log('5. Peer Mentor:         karthik@gmail.com  | password');
  console.log('--------------------------------------------------');
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
