# -*- mode: ruby -*-
# vi: set ft=ruby :

VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|

  config.vm.define :projectabe do |projectabe|
    #projectabe.vm.box = "ubuntu/disco64"
    projectabe.vm.box = "ubuntu/focal64"
    projectabe.vm.network :private_network, ip: "172.30.30.99"
    projectabe.vm.hostname = "projectabe"
    #projectabe.vm.provision :shell, :path => "./deploy/deploy-projectabe.sh"
    projectabe.vm.synced_folder "./", "/vagrant", id: "vagrant-root"
  end

  config.vm.provider :virtualbox do |projectabe|
    projectabe.customize ["modifyvm", :id, "--memory", "2048", "--ioapic", "on"]
    config.vm.network "forwarded_port", guest: 5001, host: 5001
  end
end

