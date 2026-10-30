insert into words (category, word, hint) values
('Fruits','Apple','Fruit'),('Fruits','Banana','Fruit'),('Fruits','Mango','Fruit'),
('Animals','Elephant','Animal'),('Animals','Penguin','Animal'),('Animals','Tiger','Animal'),
('Movies','Titanic','Movie'),('Movies','Inception','Movie'),('Movies','Avatar','Movie'),
('Technology','Laptop','Technology'),('Technology','Router','Technology'),('Technology','Drone','Technology'),
('Countries','Japan','Country'),('Countries','Brazil','Country'),('Countries','Egypt','Country'),
('Sports','Cricket','Sport'),('Sports','Tennis','Sport'),('Sports','Hockey','Sport'),
('Food','Pizza','Food'),('Food','Biryani','Food'),('Food','Burger','Food'),
('Professions','Doctor','Profession'),('Professions','Pilot','Profession'),('Professions','Chef','Profession'),
('Objects','Umbrella','Object'),('Objects','Candle','Object'),('Objects','Scissors','Object')
on conflict do nothing;
