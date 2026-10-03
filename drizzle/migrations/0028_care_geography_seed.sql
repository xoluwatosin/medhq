-- The one Nigerian geography Care uses, seeded from the same list the
-- interface offers, with codes produced by the same rule.
CREATE OR REPLACE FUNCTION private.care_slug(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(regexp_replace(lower(coalesce(_value, '')), '[^a-z0-9]+', '_', 'g'), '^_+|_+$', '', 'g');
$$;

WITH source(state_label, lgas) AS (VALUES
  ('Abia', ARRAY['Aba North','Aba South','Arochukwu','Bende','Ikwuano','Isiala Ngwa North','Isiala Ngwa South','Isuikwuato','Obi Ngwa','Ohafia','Osisioma','Ugwunagbo','Ukwa East','Ukwa West','Umu Nneochi','Umuahia North','Umuahia South']),
  ('Adamawa', ARRAY['Demsa','Fufure','Ganye','Gayuk','Gombi','Grie','Hong','Jada','Lamurde','Madagali','Maiha','Mayo-Belwa','Michika','Mubi North','Mubi South','Numan','Shelleng','Song','Toungo','Yola North','Yola South']),
  ('Akwa Ibom', ARRAY['Abak','Eastern Obolo','Eket','Esit-Eket','Essien Udim','Etim-Ekpo','Etinan','Ibeno','Ibesikpo-Asutan','Ibiono-Ibom','Ika','Ikono','Ikot Abasi','Ikot Ekpene','Ini','Itu','Mbo','Mkpat-Enin','Nsit-Atai','Nsit-Ibom','Nsit-Ubium','Obot-Akara','Okobo','Onna','Oron','Oruk Anam','Udung-Uko','Ukanafun','Uruan','Urue-Offong/Oruko','Uyo']),
  ('Anambra', ARRAY['Aguata','Anambra East','Anambra West','Anaocha','Awka North','Awka South','Ayamelum','Dunukofia','Ekwusigo','Idemili North','Idemili South','Ihiala','Njikoka','Nnewi North','Nnewi South','Ogbaru','Onitsha North','Onitsha South','Orumba North','Orumba South','Oyi']),
  ('Bauchi', ARRAY['Alkaleri','Bauchi','Bogoro','Damban','Darazo','Dass','Gamawa','Ganjuwa','Giade','Itas/Gadau','Jama''are','Katagum','Kirfi','Misau','Ningi','Shira','Tafawa Balewa','Toro','Warji','Zaki']),
  ('Bayelsa', ARRAY['Brass','Ekeremor','Kolokuma/Opokuma','Nembe','Ogbia','Sagbama','Southern Ijaw','Yenagoa']),
  ('Benue', ARRAY['Ado','Agatu','Apa','Buruku','Gboko','Guma','Gwer East','Gwer West','Katsina-Ala','Konshisha','Kwande','Logo','Makurdi','Obi','Ogbadibo','Ohimini','Oju','Okpokwu','Otukpo','Tarka','Ukum','Ushongo','Vandeikya']),
  ('Borno', ARRAY['Abadam','Askira/Uba','Bama','Bayo','Biu','Chibok','Damboa','Dikwa','Gubio','Guzamala','Gwoza','Hawul','Jere','Kaga','Kala/Balge','Konduga','Kukawa','Kwaya Kusar','Mafa','Magumeri','Maiduguri','Marte','Mobbar','Monguno','Ngala','Nganzai','Shani']),
  ('Cross River', ARRAY['Abi','Akamkpa','Akpabuyo','Bakassi','Bekwarra','Biase','Boki','Calabar Municipal','Calabar South','Etung','Ikom','Obanliku','Obubra','Obudu','Odukpani','Ogoja','Yakuur','Yala']),
  ('Delta', ARRAY['Aniocha North','Aniocha South','Bomadi','Burutu','Ethiope East','Ethiope West','Ika North East','Ika South','Isoko North','Isoko South','Ndokwa East','Ndokwa West','Okpe','Oshimili North','Oshimili South','Patani','Sapele','Udu','Ughelli North','Ughelli South','Ukwuani','Uvwie','Warri North','Warri South','Warri South West']),
  ('Ebonyi', ARRAY['Abakaliki','Afikpo North','Afikpo South','Ebonyi','Ezza North','Ezza South','Ikwo','Ishielu','Ivo','Izzi','Ohaozara','Ohaukwu','Onicha']),
  ('Edo', ARRAY['Akoko-Edo','Egor','Esan Central','Esan North-East','Esan South-East','Esan West','Etsako Central','Etsako East','Etsako West','Igueben','Ikpoba-Okha','Oredo','Orhionmwon','Ovia North-East','Ovia South-West','Owan East','Owan West','Uhunmwonde']),
  ('Ekiti', ARRAY['Ado-Ekiti','Efon','Ekiti East','Ekiti South-West','Ekiti West','Emure','Gbonyin','Ido-Osi','Ijero','Ikere','Ikole','Ilejemeje','Irepodun/Ifelodun','Ise/Orun','Moba','Oye']),
  ('Enugu', ARRAY['Aninri','Awgu','Enugu East','Enugu North','Enugu South','Ezeagu','Igbo-Etiti','Igbo-Eze North','Igbo-Eze South','Isi-Uzo','Nkanu East','Nkanu West','Nsukka','Oji River','Udenu','Udi','Uzo-Uwani']),
  ('FCT', ARRAY['Abaji','Bwari','Gwagwalada','Kuje','Kwali','Municipal Area Council']),
  ('Gombe', ARRAY['Akko','Balanga','Billiri','Dukku','Funakaye','Gombe','Kaltungo','Kwami','Nafada','Shongom','Yamaltu/Deba']),
  ('Imo', ARRAY['Aboh Mbaise','Ahiazu Mbaise','Ehime Mbano','Ezinihitte Mbaise','Ideato North','Ideato South','Ihitte/Uboma','Ikeduru','Isiala Mbano','Isu','Mbaitoli','Ngor-Okpala','Njaba','Nkwerre','Nwangele','Obowo','Oguta','Ohaji/Egbema','Okigwe','Onuimo','Orlu','Orsu','Oru East','Oru West','Owerri Municipal','Owerri North','Owerri West']),
  ('Jigawa', ARRAY['Auyo','Babura','Biriniwa','Birnin-Kudu','Buji','Dutse','Gagarawa','Garki','Gumel','Guri','Gwaram','Gwiwa','Hadejia','Jahun','Kafin Hausa','Kaugama','Kazaure','Kiri Kasama','Kiyawa','Maigatari','Malam Madori','Miga','Ringim','Roni','Sule Tankarkar','Taura','Yankwashi']),
  ('Kaduna', ARRAY['Birnin Gwari','Chikun','Giwa','Igabi','Ikara','Jaba','Jema''a','Kachia','Kaduna North','Kaduna South','Kagarko','Kajuru','Kaura','Kauru','Kubau','Kudan','Lere','Makarfi','Sabon Gari','Sanga','Soba','Zangon Kataf','Zaria']),
  ('Kano', ARRAY['Ajingi','Albasu','Bagwai','Bebeji','Bichi','Bunkure','Dala','Dambatta','Dawakin Kudu','Dawakin Tofa','Doguwa','Fagge','Gabasawa','Garko','Garun Mallam','Gaya','Gezawa','Gwale','Gwarzo','Kabo','Kano Municipal','Karaye','Kibiya','Kiru','Kumbotso','Kunchi','Kura','Madobi','Makoda','Minjibir','Nasarawa','Rano','Rimin Gado','Rogo','Shanono','Sumaila','Takai','Tarauni','Tofa','Tsanyawa','Tudun Wada','Ungogo','Warawa','Wudil']),
  ('Katsina', ARRAY['Bakori','Batagarawa','Batsari','Baure','Bindawa','Charanchi','Dan Musa','Dandume','Danja','Daura','Dutsi','Dutsin-Ma','Faskari','Funtua','Ingawa','Jibia','Kafur','Kaita','Kankara','Kankia','Katsina','Kurfi','Kusada','Mai''Adua','Malumfashi','Mani','Mashi','Matazu','Musawa','Rimi','Sabuwa','Safana','Sandamu','Zango']),
  ('Kebbi', ARRAY['Aleiro','Arewa Dandi','Argungu','Augie','Bagudo','Birnin Kebbi','Bunza','Dandi','Fakai','Gwandu','Jega','Kalgo','Koko/Besse','Maiyama','Ngaski','Sakaba','Shanga','Suru','Wasagu/Danko','Yauri','Zuru']),
  ('Kogi', ARRAY['Adavi','Ajaokuta','Ankpa','Bassa','Dekina','Ibaji','Idah','Igalamela-Odolu','Ijumu','Kabba/Bunu','Kogi','Lokoja','Mopa-Muro','Ofu','Ogori/Magongo','Okehi','Okene','Olamaboro','Omala','Yagba East','Yagba West']),
  ('Kwara', ARRAY['Asa','Baruten','Edu','Ekiti','Ifelodun','Ilorin East','Ilorin South','Ilorin West','Irepodun','Isin','Kaiama','Moro','Offa','Oke Ero','Oyun','Pategi']),
  ('Lagos', ARRAY['Agege','Ajeromi-Ifelodun','Alimosho','Amuwo-Odofin','Apapa','Badagry','Epe','Eti-Osa','Ibeju-Lekki','Ifako-Ijaiye','Ikeja','Ikorodu','Kosofe','Lagos Island','Lagos Mainland','Mushin','Ojo','Oshodi-Isolo','Shomolu','Surulere']),
  ('Nasarawa', ARRAY['Akwanga','Awe','Doma','Karu','Keana','Keffi','Kokona','Lafia','Nasarawa','Nasarawa Eggon','Obi','Toto','Wamba']),
  ('Niger', ARRAY['Agaie','Agwara','Bida','Borgu','Bosso','Chanchaga','Edati','Gbako','Gurara','Katcha','Kontagora','Lapai','Lavun','Magama','Mariga','Mashegu','Mokwa','Munya','Paikoro','Rafi','Rijau','Shiroro','Suleja','Tafa','Wushishi']),
  ('Ogun', ARRAY['Abeokuta North','Abeokuta South','Ado-Odo/Ota','Ewekoro','Ifo','Ijebu East','Ijebu North','Ijebu North East','Ijebu Ode','Ikenne','Imeko Afon','Ipokia','Obafemi-Owode','Odeda','Odogbolu','Ogun Waterside','Remo North','Sagamu','Yewa North','Yewa South']),
  ('Ondo', ARRAY['Akoko North-East','Akoko North-West','Akoko South-East','Akoko South-West','Akure North','Akure South','Ese-Odo','Idanre','Ifedore','Ilaje','Ile-Oluji/Okeigbo','Irele','Odigbo','Okitipupa','Ondo East','Ondo West','Ose','Owo']),
  ('Osun', ARRAY['Aiyedaade','Aiyedire','Atakumosa East','Atakumosa West','Boluwaduro','Boripe','Ede North','Ede South','Egbedore','Ejigbo','Ife Central','Ife East','Ife North','Ife South','Ifedayo','Ifelodun','Ila','Ilesa East','Ilesa West','Irepodun','Irewole','Isokan','Iwo','Obokun','Odo-Otin','Ola Oluwa','Olorunda','Oriade','Orolu','Osogbo']),
  ('Oyo', ARRAY['Afijio','Akinyele','Atiba','Atisbo','Egbeda','Ibadan North','Ibadan North-East','Ibadan North-West','Ibadan South-East','Ibadan South-West','Ibarapa Central','Ibarapa East','Ibarapa North','Ido','Irepo','Iseyin','Itesiwaju','Iwajowa','Kajola','Lagelu','Ogbomosho North','Ogbomosho South','Ogo Oluwa','Oluyole','Ona Ara','Orelope','Ori Ire','Oyo East','Oyo West','Saki East','Saki West','Surulere']),
  ('Plateau', ARRAY['Barkin Ladi','Bassa','Bokkos','Jos East','Jos North','Jos South','Kanam','Kanke','Langtang North','Langtang South','Mangu','Mikang','Pankshin','Qua''an Pan','Riyom','Shendam','Wase']),
  ('Rivers', ARRAY['Abua/Odual','Ahoada East','Ahoada West','Akuku-Toru','Andoni','Asari-Toru','Bonny','Degema','Eleme','Emuoha','Etche','Gokana','Ikwerre','Khana','Obio/Akpor','Ogba/Egbema/Ndoni','Ogu/Bolo','Okrika','Omuma','Opobo/Nkoro','Oyigbo','Port Harcourt','Tai']),
  ('Sokoto', ARRAY['Binji','Bodinga','Dange-Shuni','Gada','Goronyo','Gudu','Gwadabawa','Illela','Isa','Kebbe','Kware','Rabah','Sabon Birni','Shagari','Silame','Sokoto North','Sokoto South','Tambuwal','Tangaza','Tureta','Wamako','Wurno','Yabo']),
  ('Taraba', ARRAY['Ardo Kola','Bali','Donga','Gashaka','Gassol','Ibi','Jalingo','Karim Lamido','Kumi','Lau','Sardauna','Takum','Ussa','Wukari','Yorro','Zing']),
  ('Yobe', ARRAY['Bade','Bursari','Damaturu','Fika','Fune','Geidam','Gujba','Gulani','Jakusko','Karasuwa','Machina','Nangere','Nguru','Potiskum','Tarmuwa','Yunusari','Yusufari']),
  ('Zamfara', ARRAY['Anka','Bakura','Birnin Magaji/Kiyaw','Bukkuyum','Bungudu','Gummi','Gusau','Kaura Namoda','Maradun','Maru','Shinkafi','Talata Mafara','Tsafe','Zurmi'])
)
INSERT INTO public.care_states (code, label)
SELECT private.care_slug(state_label), state_label FROM source
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

WITH source(state_label, lgas) AS (VALUES
  ('Abia', ARRAY['Aba North','Aba South','Arochukwu','Bende','Ikwuano','Isiala Ngwa North','Isiala Ngwa South','Isuikwuato','Obi Ngwa','Ohafia','Osisioma','Ugwunagbo','Ukwa East','Ukwa West','Umu Nneochi','Umuahia North','Umuahia South']),
  ('Adamawa', ARRAY['Demsa','Fufure','Ganye','Gayuk','Gombi','Grie','Hong','Jada','Lamurde','Madagali','Maiha','Mayo-Belwa','Michika','Mubi North','Mubi South','Numan','Shelleng','Song','Toungo','Yola North','Yola South']),
  ('Akwa Ibom', ARRAY['Abak','Eastern Obolo','Eket','Esit-Eket','Essien Udim','Etim-Ekpo','Etinan','Ibeno','Ibesikpo-Asutan','Ibiono-Ibom','Ika','Ikono','Ikot Abasi','Ikot Ekpene','Ini','Itu','Mbo','Mkpat-Enin','Nsit-Atai','Nsit-Ibom','Nsit-Ubium','Obot-Akara','Okobo','Onna','Oron','Oruk Anam','Udung-Uko','Ukanafun','Uruan','Urue-Offong/Oruko','Uyo']),
  ('Anambra', ARRAY['Aguata','Anambra East','Anambra West','Anaocha','Awka North','Awka South','Ayamelum','Dunukofia','Ekwusigo','Idemili North','Idemili South','Ihiala','Njikoka','Nnewi North','Nnewi South','Ogbaru','Onitsha North','Onitsha South','Orumba North','Orumba South','Oyi']),
  ('Bauchi', ARRAY['Alkaleri','Bauchi','Bogoro','Damban','Darazo','Dass','Gamawa','Ganjuwa','Giade','Itas/Gadau','Jama''are','Katagum','Kirfi','Misau','Ningi','Shira','Tafawa Balewa','Toro','Warji','Zaki']),
  ('Bayelsa', ARRAY['Brass','Ekeremor','Kolokuma/Opokuma','Nembe','Ogbia','Sagbama','Southern Ijaw','Yenagoa']),
  ('Benue', ARRAY['Ado','Agatu','Apa','Buruku','Gboko','Guma','Gwer East','Gwer West','Katsina-Ala','Konshisha','Kwande','Logo','Makurdi','Obi','Ogbadibo','Ohimini','Oju','Okpokwu','Otukpo','Tarka','Ukum','Ushongo','Vandeikya']),
  ('Borno', ARRAY['Abadam','Askira/Uba','Bama','Bayo','Biu','Chibok','Damboa','Dikwa','Gubio','Guzamala','Gwoza','Hawul','Jere','Kaga','Kala/Balge','Konduga','Kukawa','Kwaya Kusar','Mafa','Magumeri','Maiduguri','Marte','Mobbar','Monguno','Ngala','Nganzai','Shani']),
  ('Cross River', ARRAY['Abi','Akamkpa','Akpabuyo','Bakassi','Bekwarra','Biase','Boki','Calabar Municipal','Calabar South','Etung','Ikom','Obanliku','Obubra','Obudu','Odukpani','Ogoja','Yakuur','Yala']),
  ('Delta', ARRAY['Aniocha North','Aniocha South','Bomadi','Burutu','Ethiope East','Ethiope West','Ika North East','Ika South','Isoko North','Isoko South','Ndokwa East','Ndokwa West','Okpe','Oshimili North','Oshimili South','Patani','Sapele','Udu','Ughelli North','Ughelli South','Ukwuani','Uvwie','Warri North','Warri South','Warri South West']),
  ('Ebonyi', ARRAY['Abakaliki','Afikpo North','Afikpo South','Ebonyi','Ezza North','Ezza South','Ikwo','Ishielu','Ivo','Izzi','Ohaozara','Ohaukwu','Onicha']),
  ('Edo', ARRAY['Akoko-Edo','Egor','Esan Central','Esan North-East','Esan South-East','Esan West','Etsako Central','Etsako East','Etsako West','Igueben','Ikpoba-Okha','Oredo','Orhionmwon','Ovia North-East','Ovia South-West','Owan East','Owan West','Uhunmwonde']),
  ('Ekiti', ARRAY['Ado-Ekiti','Efon','Ekiti East','Ekiti South-West','Ekiti West','Emure','Gbonyin','Ido-Osi','Ijero','Ikere','Ikole','Ilejemeje','Irepodun/Ifelodun','Ise/Orun','Moba','Oye']),
  ('Enugu', ARRAY['Aninri','Awgu','Enugu East','Enugu North','Enugu South','Ezeagu','Igbo-Etiti','Igbo-Eze North','Igbo-Eze South','Isi-Uzo','Nkanu East','Nkanu West','Nsukka','Oji River','Udenu','Udi','Uzo-Uwani']),
  ('FCT', ARRAY['Abaji','Bwari','Gwagwalada','Kuje','Kwali','Municipal Area Council']),
  ('Gombe', ARRAY['Akko','Balanga','Billiri','Dukku','Funakaye','Gombe','Kaltungo','Kwami','Nafada','Shongom','Yamaltu/Deba']),
  ('Imo', ARRAY['Aboh Mbaise','Ahiazu Mbaise','Ehime Mbano','Ezinihitte Mbaise','Ideato North','Ideato South','Ihitte/Uboma','Ikeduru','Isiala Mbano','Isu','Mbaitoli','Ngor-Okpala','Njaba','Nkwerre','Nwangele','Obowo','Oguta','Ohaji/Egbema','Okigwe','Onuimo','Orlu','Orsu','Oru East','Oru West','Owerri Municipal','Owerri North','Owerri West']),
  ('Jigawa', ARRAY['Auyo','Babura','Biriniwa','Birnin-Kudu','Buji','Dutse','Gagarawa','Garki','Gumel','Guri','Gwaram','Gwiwa','Hadejia','Jahun','Kafin Hausa','Kaugama','Kazaure','Kiri Kasama','Kiyawa','Maigatari','Malam Madori','Miga','Ringim','Roni','Sule Tankarkar','Taura','Yankwashi']),
  ('Kaduna', ARRAY['Birnin Gwari','Chikun','Giwa','Igabi','Ikara','Jaba','Jema''a','Kachia','Kaduna North','Kaduna South','Kagarko','Kajuru','Kaura','Kauru','Kubau','Kudan','Lere','Makarfi','Sabon Gari','Sanga','Soba','Zangon Kataf','Zaria']),
  ('Kano', ARRAY['Ajingi','Albasu','Bagwai','Bebeji','Bichi','Bunkure','Dala','Dambatta','Dawakin Kudu','Dawakin Tofa','Doguwa','Fagge','Gabasawa','Garko','Garun Mallam','Gaya','Gezawa','Gwale','Gwarzo','Kabo','Kano Municipal','Karaye','Kibiya','Kiru','Kumbotso','Kunchi','Kura','Madobi','Makoda','Minjibir','Nasarawa','Rano','Rimin Gado','Rogo','Shanono','Sumaila','Takai','Tarauni','Tofa','Tsanyawa','Tudun Wada','Ungogo','Warawa','Wudil']),
  ('Katsina', ARRAY['Bakori','Batagarawa','Batsari','Baure','Bindawa','Charanchi','Dan Musa','Dandume','Danja','Daura','Dutsi','Dutsin-Ma','Faskari','Funtua','Ingawa','Jibia','Kafur','Kaita','Kankara','Kankia','Katsina','Kurfi','Kusada','Mai''Adua','Malumfashi','Mani','Mashi','Matazu','Musawa','Rimi','Sabuwa','Safana','Sandamu','Zango']),
  ('Kebbi', ARRAY['Aleiro','Arewa Dandi','Argungu','Augie','Bagudo','Birnin Kebbi','Bunza','Dandi','Fakai','Gwandu','Jega','Kalgo','Koko/Besse','Maiyama','Ngaski','Sakaba','Shanga','Suru','Wasagu/Danko','Yauri','Zuru']),
  ('Kogi', ARRAY['Adavi','Ajaokuta','Ankpa','Bassa','Dekina','Ibaji','Idah','Igalamela-Odolu','Ijumu','Kabba/Bunu','Kogi','Lokoja','Mopa-Muro','Ofu','Ogori/Magongo','Okehi','Okene','Olamaboro','Omala','Yagba East','Yagba West']),
  ('Kwara', ARRAY['Asa','Baruten','Edu','Ekiti','Ifelodun','Ilorin East','Ilorin South','Ilorin West','Irepodun','Isin','Kaiama','Moro','Offa','Oke Ero','Oyun','Pategi']),
  ('Lagos', ARRAY['Agege','Ajeromi-Ifelodun','Alimosho','Amuwo-Odofin','Apapa','Badagry','Epe','Eti-Osa','Ibeju-Lekki','Ifako-Ijaiye','Ikeja','Ikorodu','Kosofe','Lagos Island','Lagos Mainland','Mushin','Ojo','Oshodi-Isolo','Shomolu','Surulere']),
  ('Nasarawa', ARRAY['Akwanga','Awe','Doma','Karu','Keana','Keffi','Kokona','Lafia','Nasarawa','Nasarawa Eggon','Obi','Toto','Wamba']),
  ('Niger', ARRAY['Agaie','Agwara','Bida','Borgu','Bosso','Chanchaga','Edati','Gbako','Gurara','Katcha','Kontagora','Lapai','Lavun','Magama','Mariga','Mashegu','Mokwa','Munya','Paikoro','Rafi','Rijau','Shiroro','Suleja','Tafa','Wushishi']),
  ('Ogun', ARRAY['Abeokuta North','Abeokuta South','Ado-Odo/Ota','Ewekoro','Ifo','Ijebu East','Ijebu North','Ijebu North East','Ijebu Ode','Ikenne','Imeko Afon','Ipokia','Obafemi-Owode','Odeda','Odogbolu','Ogun Waterside','Remo North','Sagamu','Yewa North','Yewa South']),
  ('Ondo', ARRAY['Akoko North-East','Akoko North-West','Akoko South-East','Akoko South-West','Akure North','Akure South','Ese-Odo','Idanre','Ifedore','Ilaje','Ile-Oluji/Okeigbo','Irele','Odigbo','Okitipupa','Ondo East','Ondo West','Ose','Owo']),
  ('Osun', ARRAY['Aiyedaade','Aiyedire','Atakumosa East','Atakumosa West','Boluwaduro','Boripe','Ede North','Ede South','Egbedore','Ejigbo','Ife Central','Ife East','Ife North','Ife South','Ifedayo','Ifelodun','Ila','Ilesa East','Ilesa West','Irepodun','Irewole','Isokan','Iwo','Obokun','Odo-Otin','Ola Oluwa','Olorunda','Oriade','Orolu','Osogbo']),
  ('Oyo', ARRAY['Afijio','Akinyele','Atiba','Atisbo','Egbeda','Ibadan North','Ibadan North-East','Ibadan North-West','Ibadan South-East','Ibadan South-West','Ibarapa Central','Ibarapa East','Ibarapa North','Ido','Irepo','Iseyin','Itesiwaju','Iwajowa','Kajola','Lagelu','Ogbomosho North','Ogbomosho South','Ogo Oluwa','Oluyole','Ona Ara','Orelope','Ori Ire','Oyo East','Oyo West','Saki East','Saki West','Surulere']),
  ('Plateau', ARRAY['Barkin Ladi','Bassa','Bokkos','Jos East','Jos North','Jos South','Kanam','Kanke','Langtang North','Langtang South','Mangu','Mikang','Pankshin','Qua''an Pan','Riyom','Shendam','Wase']),
  ('Rivers', ARRAY['Abua/Odual','Ahoada East','Ahoada West','Akuku-Toru','Andoni','Asari-Toru','Bonny','Degema','Eleme','Emuoha','Etche','Gokana','Ikwerre','Khana','Obio/Akpor','Ogba/Egbema/Ndoni','Ogu/Bolo','Okrika','Omuma','Opobo/Nkoro','Oyigbo','Port Harcourt','Tai']),
  ('Sokoto', ARRAY['Binji','Bodinga','Dange-Shuni','Gada','Goronyo','Gudu','Gwadabawa','Illela','Isa','Kebbe','Kware','Rabah','Sabon Birni','Shagari','Silame','Sokoto North','Sokoto South','Tambuwal','Tangaza','Tureta','Wamako','Wurno','Yabo']),
  ('Taraba', ARRAY['Ardo Kola','Bali','Donga','Gashaka','Gassol','Ibi','Jalingo','Karim Lamido','Kumi','Lau','Sardauna','Takum','Ussa','Wukari','Yorro','Zing']),
  ('Yobe', ARRAY['Bade','Bursari','Damaturu','Fika','Fune','Geidam','Gujba','Gulani','Jakusko','Karasuwa','Machina','Nangere','Nguru','Potiskum','Tarmuwa','Yunusari','Yusufari']),
  ('Zamfara', ARRAY['Anka','Bakura','Birnin Magaji/Kiyaw','Bukkuyum','Bungudu','Gummi','Gusau','Kaura Namoda','Maradun','Maru','Shinkafi','Talata Mafara','Tsafe','Zurmi'])
)
INSERT INTO public.care_lgas (code, state_code, label)
SELECT private.care_slug(state_label) || '__' || private.care_slug(lga), private.care_slug(state_label), lga
FROM source, unnest(lgas) AS lga
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, state_code = EXCLUDED.state_code;